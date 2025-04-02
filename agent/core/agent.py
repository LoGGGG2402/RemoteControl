# agent/core/agent.py
import os
import sys
import json
import time
import threading
import platform
import uuid
import subprocess

# Windows specific imports
import win32event
import win32api
import winerror

# Third-party library imports
import requests

# Local application imports
import agent.core.helper.choco_handle as choco_handle
import agent.core.utils.startup_manager as startup_manager
import agent.core.utils.logger as logger
from agent.core.command_handler import CommandHandler
from agent.core.utils.ui import SetupDialog, show_error, show_question
from agent.core.utils.system_tray import SystemTrayIcon
import agent.core.helper.system_info as system_info

# --- Định danh duy nhất cho Mutex và Event ---
# !!! CRITICAL: This APP_GUID MUST be consistent across agent versions !!!
# If this GUID changes between versions, new versions cannot signal old ones to shutdown.
# Only change this if you want to completely break compatibility with previous versions.
APP_GUID = startup_manager.APP_GUID # Use the same GUID from startup_manager
PREFIX = "Global\\" if startup_manager.is_admin() else "" # Tự động chọn prefix dựa trên quyền
MUTEX_NAME = f"{PREFIX}RemoteControlAgentMutex_{APP_GUID}"
EVENT_NAME = f"{PREFIX}RemoteControlAgentShutdownEvent_{APP_GUID}"


class Agent:
    def __init__(self):
        if platform.system() != 'Windows':
            logger.error("This agent only runs on Windows. Exiting.")
            sys.exit(1)

        # Khởi tạo các biến quản lý instance
        self.mutex_handle = None
        self.event_handle = None
        self.shutdown_listener_thread = None
        self.stop_shutdown_listener = threading.Event() # Cờ để dừng luồng listener
        self.command_handler = None # Initialize command_handler to None

        # Xử lý instance (đã thay thế hoàn toàn)
        instance_status = self.handle_instance_management()
        if instance_status == "EXIT_SIGNALED":
            logger.info("Đã gửi tín hiệu cho instance khác, instance này sẽ thoát.")
            sys.exit(0)
        elif instance_status == "ERROR":
            logger.error("Lỗi nghiêm trọng khi quản lý instance. Thoát.")
            sys.exit(1)

        # Load or create configuration, including agent_uuid
        self.computer_id = None
        self.agent_uuid = None # Initialize agent_uuid
        self.config = self.load_or_create_config()
        if not self.config:
            logger.error("Failed to load or create configuration. Exiting.")
            sys.exit(1)

        # Extract config values after loading
        self.agent_uuid = self.config.get("agent_uuid") # Get the agent_uuid
        logger.info(f"Agent UUID: {self.agent_uuid}")
        self.api_url = f"{self.config['server_link']}/api/agent"
        self.room_name = self.config["room_name"]
        self.row_index = self.config["row_index"]
        self.column_index = self.config["column_index"]
        self.ws_handler = None # Initialize ws_handler

        # Đường dẫn cài đặt (thay thế service_destination_path)
        self.install_path = startup_manager.get_install_path()

        # Khởi tạo System Tray
        self.system_tray = SystemTrayIcon(
             update_config_callback=self.update_config,
             register_startup_callback=self.register_startup, # Thêm callback
             unregister_startup_callback=self.unregister_startup # Thêm callback
         )
        self.system_tray.update_startup_status(startup_manager.check_startup_task_exists())

    def handle_instance_management(self):
        """Quản lý instance bằng Mutex và Named Event để thay thế instance cũ."""
        try:
            self.mutex_handle = win32event.CreateMutex(None, 1, MUTEX_NAME)
            last_error = win32api.GetLastError()

            if last_error == winerror.ERROR_ALREADY_EXISTS:
                logger.warning(f"Mutex '{MUTEX_NAME}' đã tồn tại. Gửi tín hiệu thay thế.")
                if self.mutex_handle:
                    win32api.CloseHandle(self.mutex_handle)
                    self.mutex_handle = None

                event_handle_to_signal = None
                try:
                    event_handle_to_signal = win32event.OpenEvent(
                        win32event.EVENT_MODIFY_STATE, False, EVENT_NAME
                    )
                    if not event_handle_to_signal:
                        logger.error(f"Không thể mở Event '{EVENT_NAME}'. Lỗi: {win32api.GetLastError()}. Giả định có thể chạy.")
                        self.mutex_handle = win32event.CreateMutex(None, 1, MUTEX_NAME)
                        if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
                             logger.error("Vẫn không thể tạo Mutex sau khi không mở được Event.")
                             return "ERROR"
                        return self._setup_first_instance_event_and_listener()

                    win32event.SetEvent(event_handle_to_signal)
                    logger.info(f"Đã gửi tín hiệu thành công qua Event '{EVENT_NAME}'.")
                    return "EXIT_SIGNALED"

                except Exception as e:
                    logger.error(f"Lỗi khi gửi tín hiệu qua Event: {e}")
                    return "EXIT_SIGNALED"
                finally:
                    if event_handle_to_signal:
                        win32api.CloseHandle(event_handle_to_signal)

            elif last_error == 0:
                logger.info(f"Đã tạo Mutex '{MUTEX_NAME}' thành công.")
                return self._setup_first_instance_event_and_listener()

            else:
                logger.error(f"Lỗi không mong muốn khi tạo Mutex '{MUTEX_NAME}': {last_error}")
                return "ERROR"

        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng trong handle_instance_management: {e}")
            self.release_instance_handles()
            return "ERROR"

    def _setup_first_instance_event_and_listener(self):
        """Tạo Named Event và khởi chạy luồng lắng nghe cho instance đầu tiên."""
        try:
            self.event_handle = win32event.CreateEvent(None, True, False, EVENT_NAME)
            if not self.event_handle:
                logger.error(f"Không thể tạo Event '{EVENT_NAME}'. Lỗi: {win32api.GetLastError()}")
                return "FIRST_INSTANCE"

            logger.info(f"Đã tạo Event '{EVENT_NAME}' thành công.")

            self.stop_shutdown_listener.clear()
            self.shutdown_listener_thread = threading.Thread(target=self._shutdown_listener, daemon=True)
            self.shutdown_listener_thread.start()
            logger.info("Đã khởi chạy luồng lắng nghe tín hiệu shutdown.")
            return "FIRST_INSTANCE"

        except Exception as e:
            logger.error(f"Lỗi khi thiết lập Event/Listener: {e}")
            self.release_instance_handles()
            return "FIRST_INSTANCE"

    def _shutdown_listener(self):
        """Luồng chạy nền, đợi tín hiệu Event để khởi động lại."""
        logger.info(f"Luồng lắng nghe ({threading.get_ident()}) bắt đầu, đợi Event '{EVENT_NAME}'.")
        while not self.stop_shutdown_listener.is_set():
            try:
                result = win32event.WaitForSingleObject(self.event_handle, 1000)

                if self.stop_shutdown_listener.is_set():
                    logger.info(f"Luồng lắng nghe ({threading.get_ident()}) nhận tín hiệu dừng từ bên ngoài.")
                    break

                if result == win32event.WAIT_OBJECT_0:
                    logger.warning(f"Luồng lắng nghe ({threading.get_ident()}) nhận được tín hiệu thay thế!")
                    logger.warning("Chuẩn bị đóng instance hiện tại và khởi chạy lại...")

                    self.cleanup(is_relaunching=True)

                    time.sleep(1)

                    executable = sys.executable
                    args = sys.argv
                    logger.info(f"Khởi chạy lại: {executable} {' '.join(args)}")
                    try:
                        subprocess.Popen(
                            [executable] + args[1:], 
                            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
                        )
                        logger.info("Đã khởi chạy tiến trình mới.")
                    except Exception as relaunch_error:
                         logger.error(f"LỖI: Không thể khởi chạy lại ứng dụng: {relaunch_error}")
                         pass

                    logger.warning(f"Thoát instance cũ (PID: {os.getpid()}) ngay lập tức.")
                    os._exit(1)

                elif result == win32event.WAIT_TIMEOUT:
                    continue
                else:
                    logger.error(f"Lỗi WaitForSingleObject trong luồng lắng nghe: {win32api.GetLastError()}")
                    break

            except Exception as e:
                logger.error(f"Lỗi không mong muốn trong luồng lắng nghe: {e}")
                break
        logger.info(f"Luồng lắng nghe ({threading.get_ident()}) kết thúc.")

    def release_instance_handles(self):
        """Giải phóng tài nguyên Mutex và Event một cách an toàn."""
        if hasattr(self, 'mutex_handle') and self.mutex_handle:
            try:
                win32api.CloseHandle(self.mutex_handle)
                self.mutex_handle = None
                logger.info("Mutex handle released.")
            except Exception as e:
                logger.error(f"Error releasing mutex handle: {e}")
        if hasattr(self, 'event_handle') and self.event_handle:
            try:
                win32api.CloseHandle(self.event_handle)
                self.event_handle = None
                logger.info("Event handle released.")
            except Exception as e:
                logger.error(f"Error releasing event handle: {e}")

    def cleanup(self, is_relaunching=False):
        """Performs graceful shutdown of agent components."""
        logger.info(f"Starting cleanup sequence... (Relaunching: {is_relaunching})")

        if hasattr(self, 'stop_shutdown_listener') and not self.stop_shutdown_listener.is_set():
            self.stop_shutdown_listener.set()
            logger.info("Signaled shutdown listener thread to stop.")

        if hasattr(self, 'command_handler') and self.command_handler:
            logger.info("Stopping Command Handler...")
            try:
                self.command_handler.stop()
                logger.info("Command Handler stopped.")
            except Exception as e:
                logger.error(f"Error stopping Command Handler: {e}")
        else:
            logger.info("Command Handler not initialized or already stopped.")

        current_thread_id = threading.get_ident()
        listener_thread_id = self.shutdown_listener_thread.ident if hasattr(self, 'shutdown_listener_thread') and self.shutdown_listener_thread else None

        if listener_thread_id and current_thread_id != listener_thread_id and self.shutdown_listener_thread.is_alive():
            logger.info("Waiting for shutdown listener thread to finish...")
            self.shutdown_listener_thread.join(timeout=2)
            if self.shutdown_listener_thread.is_alive():
                logger.warning("Shutdown listener thread did not finish in time.")
            else:
                logger.info("Shutdown listener thread finished.")
        elif listener_thread_id and current_thread_id == listener_thread_id:
             logger.info("Cleanup called from within shutdown listener thread, skipping join.")

        logger.info("Releasing instance handles...")
        self.release_instance_handles()
        logger.info("Instance handles released.")

        if hasattr(self, 'system_tray') and self.system_tray and not is_relaunching:
            logger.info("Stopping system tray...")
            try:
                self.system_tray.stop()
                logger.info("System tray stopped.")
            except Exception as e:
                 logger.error(f"Error stopping system tray: {e}")
        elif is_relaunching:
             logger.info("Skipping system tray stop during relaunch.")

        logger.info("Cleanup sequence finished.")

    def __del__(self):
        """Destructor as a fallback cleanup."""
        logger.warning("Agent destructor (__del__) called. Performing fallback cleanup.")
        self.release_instance_handles()

    def validate_config(self, config, is_update=False):
        """
        Validates configuration by attempting to connect to the server.
        
        Args:
            config (dict): The configuration to validate
            is_update (bool): Whether this is an update to existing config (True) or new config (False)
            
        Returns:
            tuple: (status, message, details)
                - status: One of "valid", "invalid_params", "connection_failed"
                - message: User-friendly message explaining the result
                - details: Additional details for logging or debugging
        """
        logger.info(f"Validating {'updated' if is_update else 'new'} configuration by connecting to server...")
        
        try:
            # Basic parameter validation
            server_link = config.get("server_link", "").strip()
            room_name = config.get("room_name", "")
            row_index = config.get("row_index")
            column_index = config.get("column_index")
            
            if not server_link:
                return "invalid_params", "Server link cannot be empty", "Missing server_link"
            if not room_name:
                return "invalid_params", "Room name cannot be empty", "Missing room_name"
            if row_index is None or not isinstance(row_index, int):
                return "invalid_params", "Row index must be a valid number", f"Invalid row_index: {row_index}"
            if column_index is None or not isinstance(column_index, int):
                return "invalid_params", "Column index must be a valid number", f"Invalid column_index: {column_index}"
            
            # Construct test URL - use the connect endpoint
            test_url = f"{server_link}/api/agent/connect"
            
            # Get system information for the connection test
            import socket
            import platform
            try:
                hostname = socket.gethostname()
                ip_address = socket.gethostbyname(hostname)
            except Exception as e:
                logger.warning(f"Could not determine hostname or IP address: {e}")
                hostname = platform.node() or "Unknown"
                ip_address = "127.0.0.1"  # Fallback to localhost
                
            # Connection test payload
            payload = {
                "room_name": room_name,
                "row_index": row_index,
                "column_index": column_index, 
                "hostname": hostname,
                "ip_address": ip_address,
                "mac_address": system_info.get_system_info().get("mac_address", "Unknown")
            }
            
            # Set a timeout for the connection test (5 seconds)
            self.system_tray.update_status("Validating Config...")
            logger.info(f"Testing connection to: {test_url}")
            logger.debug(f"Connection test payload: {payload}")
            
            response = requests.post(test_url, json=payload, timeout=5)
            
            if response.status_code >= 400:
                error_data = response.json() if response.content else {"error": "Unknown error"}
                error_message = error_data.get("error", "Unknown error")
                error_code = error_data.get("code", "UNKNOWN_ERROR")
                
                logger.error(f"Server rejected configuration: {error_message} (Code: {error_code})")
                
                # Return user-friendly messages based on error codes
                if error_code == "ROOM_NAME_REQUIRED":
                    return "invalid_params", "Room name is required", error_code
                elif error_code == "ROOM_NOT_FOUND":
                    return "invalid_params", f"Room '{room_name}' not found on the server", error_code
                elif error_code == "INVALID_ROW_INDEX":
                    return "invalid_params", f"Invalid row index: {row_index}", error_code
                elif error_code == "INVALID_COLUMN_INDEX":
                    return "invalid_params", f"Invalid column index: {column_index}", error_code
                elif error_code == "POSITION_OCCUPIED":
                    return "invalid_params", "This position is already occupied by another computer", error_code
                else:
                    return "invalid_params", f"Server rejected configuration: {error_message}", error_code
            
            # If we get here, the server accepted our connection parameters
            logger.info("Configuration validation successful. Server accepts these parameters.")
            return "valid", "Configuration validated successfully", None
            
        except requests.ConnectionError:
            logger.error(f"Could not connect to server at {config.get('server_link')}")
            return "connection_failed", "Could not connect to server. Please check server link and network connection.", "Connection Error"
        except requests.Timeout:
            logger.error("Connection to server timed out")
            return "connection_failed", "Connection to server timed out. Server might be down or unreachable.", "Timeout"
        except requests.RequestException as e:
            logger.error(f"Request error during validation: {e}")
            return "connection_failed", f"Connection error: {str(e)}", f"RequestException: {e}"
        except Exception as e:
            logger.error(f"Unexpected error during configuration validation: {e}")
            return "connection_failed", f"Validation error: {str(e)}", f"Exception: {e}"

    def can_connect_with_current_config(self):
        """
        Tests if the current configuration can successfully connect to the server.
        
        Returns:
            bool: True if the current configuration works, False otherwise
        """
        logger.info("Testing connection with current configuration...")
        if not self.config:
            logger.error("No configuration available to test")
            return False
            
        status, _, _ = self.validate_config(self.config, is_update=True)
        return status == "valid"

    def update_config(self):
        """Cập nhật cấu hình khi admin yêu cầu từ System Tray"""
        if startup_manager.is_admin():
            logger.info("Admin requested configuration update")
            
            # Store original config to revert if needed
            original_config = self.config.copy()
            
            # Flag to control the configuration retry loop
            retry_config = True
            while retry_config:
                dialog = SetupDialog(initial_values=self.config)
                new_config = dialog.get_result()

                if not new_config:
                    logger.info("Configuration update canceled by user")
                    self.system_tray.update_status("Config Update Canceled")
                    return

                # Preserve agent_uuid in the new config if it exists in the current config
                if "agent_uuid" in self.config:
                    logger.info(f"Preserving existing agent UUID during config update: {self.config['agent_uuid']}")
                    new_config["agent_uuid"] = self.config["agent_uuid"]
                else:
                    # Generate a new one if it was somehow missing before update
                    new_uuid = str(uuid.uuid4())
                    logger.warning(f"Agent UUID missing during update. Generating new UUID: {new_uuid}")
                    new_config["agent_uuid"] = new_uuid
                    
                # Validate the new configuration before applying it
                self.system_tray.update_status("Validating Config...")
                status, message, details = self.validate_config(new_config, is_update=True)
                
                if status != "valid":
                    logger.error(f"Configuration validation failed: {message} (Details: {details})")
                    
                    # Check if the current configuration still works
                    original_config_works = self.can_connect_with_current_config()
                    
                    if original_config_works:
                        # Offer options: retry or keep original config (cancel update)
                        retry = show_question(
                            "Configuration Error", 
                            f"The provided configuration is invalid:\n\n{message}\n\n"
                            "Your current configuration is still working.\n\n"
                            "Would you like to try configuring again?",
                            options=["Try Again", "Cancel Update"]
                        )
                        retry_config = (retry == "Try Again")
                        if not retry_config:
                            logger.info("User chose to keep the current working configuration.")
                            self.system_tray.update_status("Config Update Canceled")
                            return
                    else:
                        # Current config doesn't work either, offer retry or exit application
                        choice = show_question(
                            "Configuration Error", 
                            f"The provided configuration is invalid:\n\n{message}\n\n"
                            "Your current configuration is not working either.\n\n"
                            "What would you like to do?",
                            options=["Try Again", "Exit Application"]
                        )
                        if choice == "Exit Application":
                            logger.warning("User chose to exit application due to configuration issues.")
                            self.system_tray.update_status("Exiting...")
                            self.cleanup()
                            sys.exit(1)
                        # Otherwise continue the retry loop
                else:
                    # If validation passed, proceed with updating the configuration
                    logger.info(f"Configuration validation successful: {message}")
                    retry_config = False  # Exit the retry loop
                
            # Update in-memory config
            self.config.update(new_config)
            self.agent_uuid = self.config.get("agent_uuid")
            logger.info(f"Updated agent UUID in memory: {self.agent_uuid}")

            # Save configuration to file
            config_path = os.path.join(
                os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
            )
            try:
                os.makedirs(os.path.dirname(config_path), exist_ok=True)
                with open(config_path, "w") as f:
                    json.dump(self.config, f, indent=4)
                logger.info(f"Configuration updated and saved successfully to {config_path}")
                self.system_tray.update_status("Config Updated")

                # Re-initialize connection components
                self.api_url = f"{self.config['server_link'].strip()}/api/agent"
                logger.info(f"API URL updated to: {self.api_url}")

                # Stop existing WebSocket handler cleanly before starting new one
                if hasattr(self, 'command_handler') and self.command_handler:
                    logger.info("Stopping existing command handler for reconfiguration...")
                    self.command_handler.stop()
                    logger.info("Existing command handler stopped.")

                # Connect to server and restart WebSocket handler 
                # (We already validated the connection, so this should succeed)
                self.system_tray.update_status("Reconnecting...")
                logger.info("Reconnecting to server with new configuration...")
                if self.connect_to_server():
                     logger.info("Server connection successful, updating file and application lists...")
                     self.update_list_file_and_application()
                     logger.info("Starting WebSocket handler with new configuration...")
                     self.start_websocket_handler()
                     logger.info("WebSocket handler started with new configuration.")
                     self.system_tray.update_status("Connected")
                else:
                     # This is unexpected since we already validated the config
                     logger.error("Failed to reconnect after configuration update (unexpected).")
                     self.system_tray.update_status("Reconnect Failed")
                     show_error("Connection Error", 
                               "Failed to connect to server after updating configuration.\n" +
                               "This is unexpected since validation was successful.\n\n" +
                               "Please try restarting the agent.")

            except Exception as e:
                logger.error(f"Error saving updated config: {e}")
                show_error("Error", f"Failed to save configuration: {str(e)}")
        else:
            logger.warning("Non-admin user attempted to update configuration")
            show_error("Permission Denied", "Only administrators can update the configuration.")

    def load_or_create_config(self):
        """Loads configuration from file, creates it if missing, and ensures agent_uuid exists."""
        config_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl")
        config_path = os.path.join(config_dir, "agent_config.json")
        config_data = None

        if not os.path.exists(config_dir):
            try:
                os.makedirs(config_dir)
                logger.info(f"Created configuration directory: {config_dir}")
            except OSError as e:
                logger.error(f"Failed to create configuration directory {config_dir}: {e}")
                show_error("Configuration Error", f"Failed to create configuration directory:\n{config_dir}\n\nError: {e}")
                return None

        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    config_data = json.load(f)
                logger.info(f"Successfully loaded configuration from {config_path}")
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON from configuration file {config_path}: {e}. File might be corrupted.")
                show_error("Configuration Error", f"Configuration file is corrupted:\n{config_path}\n\nPlease check the file or proceed to re-configure.")
                config_data = None
            except Exception as e:
                logger.error(f"Failed to load configuration from {config_path}: {str(e)}")
                show_error("Configuration Error", f"Failed to load configuration:\n{config_path}\n\nError: {e}")
                return None

        if config_data is not None:
            config_updated = False
            if not config_data.get("agent_uuid"):
                new_uuid = str(uuid.uuid4())
                logger.warning(f"Agent UUID not found, empty, or None in config. Generating new UUID: {new_uuid}")
                config_data["agent_uuid"] = new_uuid
                config_updated = True

            if config_updated:
                try:
                    with open(config_path, "w") as f:
                        json.dump(config_data, f, indent=4)
                    logger.info(f"Successfully saved configuration with new Agent UUID to {config_path}")
                except Exception as e:
                    logger.error(f"Failed to save configuration with new Agent UUID: {str(e)}")
                    show_error("Configuration Error", f"Failed to save configuration update:\n{config_path}\n\nError: {e}")
            return config_data

        logger.warning("Configuration file not found or invalid. Proceeding with first-time setup dialog.")
        retry_config = True
        
        while retry_config:
            dialog = SetupDialog(initial_values=None)
            new_config = dialog.get_result()
            
            if not new_config:
                logger.error("No configuration provided during setup. Exiting.")
                sys.exit(1)

            # Add agent_uuid to the newly created config
            new_uuid = str(uuid.uuid4())
            logger.info(f"Generating Agent UUID for new configuration: {new_uuid}")
            new_config["agent_uuid"] = new_uuid
            
            # Validate the new configuration before saving
            self.system_tray.update_status("Validating Config...")
            status, message, details = self.validate_config(new_config, is_update=False)
            
            if status != "valid":
                logger.error(f"Initial configuration validation failed: {message} (Details: {details})")
                choice = show_question(
                    "Configuration Error", 
                    f"The provided configuration is invalid and cannot be used:\n\n{message}\n\n"
                    "What would you like to do?",
                    options=["Try Again", "Exit Application"]
                )
                
                if choice == "Exit Application":
                    logger.warning("User chose to exit application during initial configuration.")
                    sys.exit(1)
                # Otherwise continue the retry loop
            else:
                # Configuration is valid, exit the retry loop
                logger.info(f"Initial configuration validation successful: {message}")
                retry_config = False
            
        # At this point we have valid configuration
        try:
            with open(config_path, "w") as f:
                json.dump(new_config, f, indent=4)
            logger.info(f"Successfully saved new configuration to {config_path}")
            return new_config
        except Exception as e:
            logger.error(f"Failed to save new configuration: {str(e)}")
            show_error("Configuration Error", f"Failed to save new configuration:\n{config_path}\n\nError: {e}")
            return None

    def connect_to_server(self):
        """Connects to the server and obtains a computer ID."""
        try:
            import socket
            hostname = socket.gethostname()
            try:
                ip_address = socket.gethostbyname(hostname)
            except socket.gaierror:
                import platform
                logger.warning("Could not get IP address from hostname, using platform.node() instead")
                hostname = platform.node()
                ip_address = "127.0.0.1"
            
            system_data = system_info.get_system_info()
            mac_address = system_data.get("mac_address", "Unknown")
            
            data = {
                "room_name": self.room_name,
                "row_index": self.row_index,
                "column_index": self.column_index,
                "hostname": hostname,
                "ip_address": ip_address,
                "mac_address": mac_address
            }
            
            logger.info(f"Connecting to server: {self.api_url}/connect")
            logger.debug(f"Connection data: {data}")
            
            response = requests.post(f"{self.api_url}/connect", json=data)
            
            if response.status_code == 200:
                response_data = response.json()
                self.computer_id = response_data.get("id")
                logger.info(f"Successfully connected to server. Computer ID: {self.computer_id}")
                self.system_tray.update_status("Connected")
                return True
            else:
                error_data = response.json() if response.content else {"error": "Unknown error"}
                error_message = error_data.get("error", "Unknown error")
                error_code = error_data.get("code", "UNKNOWN_ERROR")
                
                logger.error(f"Server connection failed: {error_message} (Code: {error_code})")
                self.system_tray.update_status(f"Connection Failed: {error_code}")
                
                human_readable_error = self._get_connection_error_message(error_code, error_message)
                show_error("Connection Error", human_readable_error)
                return False
        except requests.exceptions.RequestException as e:
            logger.error(f"Connection error: {e}")
            self.system_tray.update_status("Connection Error")
            show_error("Connection Error", f"Failed to connect to server: {str(e)}")
            return False

    def _get_connection_error_message(self, error_code, error_message):
        """Returns a user-friendly error message based on the error code from the server."""
        error_messages = {
            "ROOM_NAME_REQUIRED": "Room name is required. Please check your configuration.",
            "ROOM_NOT_FOUND": f"Room not found: {self.room_name}. Please check your configuration.",
            "INVALID_ROW_INDEX": f"Invalid row index: {self.row_index}. Must be within range for the room.",
            "INVALID_COLUMN_INDEX": f"Invalid column index: {self.column_index}. Must be within range for the room.",
            "POSITION_OCCUPIED": "This position is already occupied by another computer.",
            "DATABASE_ERROR": "Server database error. Please contact administrator."
        }
        
        return error_messages.get(error_code, f"Server error: {error_message}")

    def start_websocket_handler(self):
        """Khởi chạy hoặc khởi chạy lại WebSocket handler."""
        if not self.computer_id:
             logger.error("Cannot start WebSocket handler without computer ID.")
             self.system_tray.update_status("Error: No ID")
             return
        if not self.agent_uuid:
             logger.error("Cannot start WebSocket handler without Agent UUID.")
             self.system_tray.update_status("Error: No Agent UUID")
             return

        logger.info(f"Starting WebSocket handler with computer_id: {self.computer_id} and agent_uuid: {self.agent_uuid}")
        self.system_tray.update_status("Starting WebSocket...")
        self.command_handler = CommandHandler(self.computer_id, self.config)
        command_thread = threading.Thread(
            target=self.command_handler.start_websocket,
            daemon=True
        )
        command_thread.start()
        logger.info("WebSocket handler thread started.")

    def run(self):
        """Main execution flow of the agent."""
        self.system_tray.start()
        self.system_tray.update_status("Initializing...")
        logger.info("Agent starting...")

        self.system_tray.update_status("Checking Choco...")
        if not choco_handle.is_chocolatey_installed():
            logger.info("Chocolatey not found. Attempting installation...")
            self.system_tray.update_status("Installing Choco...")
            if not startup_manager.is_admin():
                 logger.error("Admin rights required to install Chocolatey.")
                 show_error("Admin Rights Required", "Chocolatey needs to be installed, but this requires Administrator rights.\nPlease run the agent as Administrator once.")
                 self.system_tray.update_status("Error: Choco Install Requires Admin")
            else:
                 success, message = choco_handle.install_chocolatey()
                 if not success:
                     logger.error(f"Failed to install Chocolatey: {message}")
                     show_error("Error", f"Failed to install Chocolatey: {message}")
                     self.system_tray.update_status("Error: Choco Install Failed")
                 else:
                     logger.info("Chocolatey installed successfully.")
                     self.system_tray.update_status("Choco Installed")
        else:
            logger.info("Chocolatey is installed.")
            self.system_tray.update_status("Choco OK")

        self.system_tray.update_status("Checking location...")
        logger.info("Ensuring application is in the correct location...")
        location_ok, final_path_or_error = startup_manager.ensure_correct_location(allow_exit=True)
        if not location_ok:
             logger.error(f"Failed to ensure correct application location: {final_path_or_error}")
             show_error("Installation Error", f"Could not move application to the correct location:\n{final_path_or_error}")
             self.system_tray.update_status("Error: Location Setup Failed")
             sys.exit(1)
        final_executable_path = final_path_or_error
        logger.info(f"Application is at the correct location: {final_executable_path}")
        self.system_tray.update_status("Location OK")

        if startup_manager.is_admin():
            self.system_tray.update_status("Checking Startup Task...")
            logger.info("Checking if startup task exists...")
            task_exists = startup_manager.check_startup_task_exists()
            if not task_exists:
                logger.info("Startup task not found. Attempting to register...")
                self.system_tray.update_status("Registering Startup...")
                success_reg, msg_reg = startup_manager.register_startup_task(final_executable_path)
                if success_reg:
                    logger.info(f"Startup task registered successfully: {msg_reg}")
                    self.system_tray.update_status("Startup Registered")
                    self.system_tray.update_startup_status(True)
                else:
                    logger.error(f"Failed to register startup task: {msg_reg}")
                    self.system_tray.update_status("Error: Startup Reg Failed")
                    self.system_tray.update_startup_status(False)
            else:
                logger.info("Startup task already exists.")
                self.system_tray.update_status("Startup OK")
                self.system_tray.update_startup_status(True)
        else:
             logger.info("Not running as admin, skipping startup task registration check.")
             startup_status = startup_manager.check_startup_task_exists()
             logger.info(f"Startup task exists: {startup_status}")
             self.system_tray.update_startup_status(startup_status)

        self.system_tray.update_status("Connecting...")
        logger.info("Attempting to connect to server...")
        if self.connect_to_server():
            logger.info("Server connection successful, updating file and application lists...")
            self.update_list_file_and_application()
            logger.info("Starting WebSocket handler...")
            self.start_websocket_handler()
        else:
            logger.error("Failed to establish initial connection to server.")
            self.system_tray.update_status("Connection Failed (Initial)")

        logger.info("Agent initialization complete. Entering main loop (waiting for shutdown signal).")
        try:
             self.stop_shutdown_listener.wait()
             logger.info("Stop signal received for main loop.")
        except KeyboardInterrupt:
             logger.info("KeyboardInterrupt received. Initiating shutdown.")
             self.stop_shutdown_listener.set()
        finally:
             logger.info("Exiting main loop. Performing final cleanup...")
             self.cleanup()

        logger.info("Agent shutdown complete.")
