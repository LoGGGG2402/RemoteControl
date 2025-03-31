# Standard library imports
import os
import sys
import json
import time
import threading
import ctypes
import win32event
import win32api
import winerror

# Third-party library imports
import requests

# Local application imports
import agent.core.helper.choco_handle as choco_handle
import agent.core.helper.file_handle as file_handle
import agent.core.helper.system_info as system_info
import agent.core.utils.install_service as install_service
import agent.core.utils.logger as logger
from agent.core.command_handler import CommandHandler
from agent.core.utils.ui import SetupDialog, show_error
from agent.core.utils.system_tray import SystemTrayIcon, is_admin


class Agent:
    def __init__(self):
        # Tạo mutex để đảm bảo chỉ có một instance chạy
        self.create_single_instance_lock()

        self.computer_id = None
        self.config = self.load_or_create_config()
        if not self.config:
            sys.exit(1)
        self.api_url = f"{self.config['server_link']}/api/agent"
        self.room_name = self.config["room_name"]
        self.row_index = self.config["row_index"]
        self.column_index = self.config["column_index"]
        self.ws_handler = None
        self.service_name = "RemoteControlAgent"
        self.service_destination_path = os.path.join(os.environ.get('ProgramFiles', 'C:\\Program Files'), 'RemoteControl')
        
        # Khởi tạo biểu tượng System Tray với callback cập nhật cấu hình
        self.system_tray = SystemTrayIcon(update_config_callback=self.update_config)
        
    def create_single_instance_lock(self):
        """
        Create a Windows mutex to ensure only one instance runs
        """
        mutex_name = "RemoteControlAgent"
        
        try:
            self.mutex = win32event.CreateMutex(None, 1, f"Global\\{mutex_name}")
            if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
                logger.error("Another instance of the agent is already running")
                sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to create mutex: {str(e)}")
            sys.exit(1)

    def update_config(self):
        """Cập nhật cấu hình khi admin yêu cầu từ System Tray"""
        if is_admin():
            logger.info("Admin requested configuration update")
            dialog = SetupDialog(initial_values=self.config)
            new_config = dialog.get_result()
            
            if new_config:
                # Cập nhật cấu hình
                self.config.update(new_config)
                config_path = os.path.join(
                    os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
                )
                with open(config_path, "w") as f:
                    json.dump(self.config, f)
                
                logger.info("Configuration updated successfully")
                self.system_tray.update_status("Config Updated")
                
                # Khởi động lại kết nối
                self.system_tray.update_status("Reconnecting...")
                if self.connect_to_server():
                    self.update_list_file_and_application()
            else:
                # User canceled the dialog
                logger.info("Configuration update canceled by user")
                self.system_tray.update_status("Config Update Canceled")
        else:
            logger.warning("Non-admin user attempted to update configuration")
            show_error("Permission Denied", "Only administrators can update the configuration.")

    def load_or_create_config(self):
        config_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl")
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)

        config_path = os.path.join(config_dir, "agent_config.json")

        if not os.path.exists(config_path):
            logger.error("First time setup required. Please enter server link and room name.")
            dialog = SetupDialog()
            new_config = dialog.get_result()
            if not new_config:
                logger.error("No configuration provided. Exiting.")
                sys.exit(1)
            
            # Save the new configuration
            with open(config_path, "w") as f:
                json.dump(new_config, f)
            return new_config

        try:
            with open(config_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load configuration: {str(e)}")
            sys.exit(1)

    def connect_to_server(self):
        while True:
            try:
                server_link = self.config["server_link"].strip()
                self.api_url = f"{server_link}/api/agent"
                sys_info = system_info.get_system_info()
                sys_info.update(
                    {
                        "room_name": self.config["room_name"],
                        "row_index": self.config["row_index"],
                        "column_index": self.config["column_index"],
                    }
                )
                try:
                    response = requests.post(f"{self.api_url}/connect", json=sys_info, timeout=5)
                    
                    # Check if response is successful
                    if response.status_code >= 400:
                        error_data = response.json() if response.text else {"error": "Unknown server error"}
                        error_message = error_data.get('error', 'Unknown error')
                        error_code = error_data.get('code', 'UNKNOWN_ERROR')
                        
                        logger.error(f"Server returned error: {error_message} (code: {error_code})")
                        self.system_tray.update_status(f"Server Error: {error_code}")
                        
                        # Show error to user if admin and prompt for reconfiguration
                        if is_admin():
                            show_error("Server Error", f"{error_message}\n\nPlease check your room configuration.")
                            dialog = SetupDialog(initial_values=self.config)
                            new_config = dialog.get_result()
                            if not new_config:
                                continue
                            self.config.update(new_config)
                            config_path = os.path.join(
                                os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
                            )
                            with open(config_path, "w") as f:
                                json.dump(self.config, f)
                            continue
                        else:
                            show_error("Server Error", f"Failed to connect to server: {error_message}\nPlease contact your administrator.")
                            return False
                    
                    data = response.json()
                    
                    if "id" not in data:
                        logger.error(f"Server response is missing 'id' field: {data}")
                        
                        # Handle the case where we got a response but no ID
                        if "error" in data:
                            error_message = data.get("error", "Unknown error")
                            error_code = data.get("code", "UNKNOWN_ERROR")
                            logger.error(f"Server error: {error_message} (code: {error_code})")
                            self.system_tray.update_status(f"Error: {error_code}")
                            
                            # Show error to admin users and allow reconfiguration
                            if is_admin():
                                show_error("Configuration Error", f"{error_message}\n\nPlease check your room configuration.")
                                dialog = SetupDialog(initial_values=self.config)
                                new_config = dialog.get_result()
                                if not new_config:
                                    continue
                                self.config.update(new_config)
                                config_path = os.path.join(
                                    os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
                                )
                                with open(config_path, "w") as f:
                                    json.dump(self.config, f)
                                continue
                            else:
                                show_error("Connection Error", f"Failed to connect to server: {error_message}\nPlease contact your administrator.")
                                return False
                        else:
                            self.system_tray.update_status("Invalid Server Response")
                            return False
                        
                    self.computer_id = data["id"]
                    logger.info(f"Connected successfully. Computer ID: {self.computer_id}")
                    
                    # Update System Tray status
                    self.system_tray.update_status("Connected")
                    return True
                except requests.exceptions.ConnectionError:
                    logger.error(
                        f"Could not connect to server at {self.api_url}. Please check if server is running and link is correct."
                    )
                    # Cập nhật trạng thái System Tray
                    self.system_tray.update_status("Connection Failed")
                    # Cho phép người dùng nhập lại server link nếu là admin
                    if is_admin():
                        dialog = SetupDialog(initial_values=self.config)
                        new_config = dialog.get_result()
                        if not new_config:
                            continue
                        self.config.update(new_config)
                        config_path = os.path.join(
                            os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
                        )
                        with open(config_path, "w") as f:
                            json.dump(self.config, f)
                        continue
                    else:
                        # Nếu không phải admin, chỉ hiển thị thông báo lỗi
                        show_error("Connection Error", 
                                "Could not connect to server. Please contact your administrator.")
                        return False
                except Exception as e:
                    logger.error(f"Connection Error: {str(e)}")
                    # Cập nhật trạng thái System Tray
                    self.system_tray.update_status("Error")
                    return False
            except Exception as e:
                logger.error(f"Connection Error: {str(e)}")
                # Cập nhật trạng thái System Tray
                self.system_tray.update_status("Error")
                return False

    def update_list_file_and_application(self):
        try:
            list_file = file_handle.get_files()
            success, list_application = choco_handle.list_installed_packages()
            if not success:
                return f"Error getting installed applications: {list_application}"

            response = requests.post(
                f"{self.api_url}/update-list-file-and-application/{self.computer_id}",
                json={"listFile": list_file, "listApplication": list_application},
                timeout=5,
            )
            return response.text
        except requests.exceptions.Timeout:
            return "Request timed out while updating lists"
        except requests.exceptions.ConnectionError:
            return "Connection error while updating lists"
        except Exception as e:
            return f"Error updating lists: {str(e)}"

    def run(self):
        # Khởi động biểu tượng System Tray
        self.system_tray.start()
        self.system_tray.update_status("Starting")
        
        # Install Chocolatey for first time setup
        if not choco_handle.is_chocolatey_installed():
            logger.info("Installing Chocolatey for the first time setup...")
            self.system_tray.update_status("Installing Chocolatey...")
            success, message = choco_handle.install_chocolatey()
            if not success:
                logger.error(f"Failed to install Chocolatey: {message}")
                show_error("Error", f"Failed to install Chocolatey: {message}")
                self.system_tray.update_status("Error: Chocolatey Install Failed")
                sys.exit(1)
            logger.info("Chocolatey installed successfully.")

        self.system_tray.update_status("Connecting...")
        if self.connect_to_server():
            self.update_list_file_and_application()
            
            # Di chuyển file thực thi đến thư mục thích hợp và đăng ký như một service
            success, result = install_service.move_executable(self.service_destination_path)
            if success and isinstance(result, str) and os.path.exists(result):
                # Nếu file thực thi được di chuyển thành công, đăng ký nó như một service
                self.system_tray.update_status("Registering service...")
                service_success, service_message = install_service.register_as_service(
                    self.service_name, result
                )
                if service_success:
                    logger.info(service_message)
                    self.system_tray.update_status("Service registered")
                else:
                    logger.error(f"Failed to register service: {service_message}")
                    self.system_tray.update_status("Service registration failed")
            
            # Start the command handler
            self.system_tray.update_status("Starting WebSocket...")
            self.command_handler = CommandHandler(self.computer_id, self.config)
            command_thread = threading.Thread(
                target=self.command_handler.start_websocket
            )
            command_thread.daemon = True
            command_thread.start()
            
            self.system_tray.update_status("Running")

            while True:
                time.sleep(1)


if __name__ == "__main__":
    agent = Agent()
    agent.run()
