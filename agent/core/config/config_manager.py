# agent/core/config/config_manager.py
import os
import sys
import json
import uuid
import requests
import agent.core.utils.logger as logger
import agent.core.helper.system_info as system_info

class ConfigManager:
    def __init__(self, ui_manager=None):
        """
        Initialize ConfigManager with optional UI manager for dialog prompts
        
        Args:
            ui_manager: Optional UIManager instance for displaying dialogs
        """
        self.ui_manager = ui_manager
        self.config = None
        self.config_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl")
        self.config_path = os.path.join(self.config_dir, "agent_config.json")
        
    def load_or_create_config(self):
        """
        Loads configuration from file, creates it if missing, and ensures agent_uuid exists.
        
        Returns:
            dict: The configuration dictionary if successful, None otherwise
        """
        config_data = None
        
        # Create config directory if it doesn't exist
        if not os.path.exists(self.config_dir):
            try:
                os.makedirs(self.config_dir)
                logger.info(f"Created configuration directory: {self.config_dir}")
            except OSError as e:
                logger.error(f"Failed to create configuration directory {self.config_dir}: {e}")
                if self.ui_manager:
                    self.ui_manager.show_error(
                        "Configuration Error", 
                        f"Failed to create configuration directory:\n{self.config_dir}\n\nError: {e}"
                    )
                return None
        
        # Load existing configuration if available
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    config_data = json.load(f)
                logger.info(f"Successfully loaded configuration from {self.config_path}")
            except json.JSONDecodeError as e:
                logger.error(f"Error decoding JSON from configuration file {self.config_path}: {e}. File might be corrupted.")
                if self.ui_manager:
                    self.ui_manager.show_error(
                        "Configuration Error", 
                        f"Configuration file is corrupted:\n{self.config_path}\n\nPlease check the file or proceed to re-configure."
                    )
                config_data = None
            except Exception as e:
                logger.error(f"Failed to load configuration from {self.config_path}: {str(e)}")
                if self.ui_manager:
                    self.ui_manager.show_error(
                        "Configuration Error", 
                        f"Failed to load configuration:\n{self.config_path}\n\nError: {e}"
                    )
                return None
        
        # Check and update existing configuration if needed
        if config_data is not None:
            config_updated = False
            
            # Generate agent_uuid if missing
            if not config_data.get("agent_uuid"):
                new_uuid = str(uuid.uuid4())
                logger.warning(f"Agent UUID not found, empty, or None in config. Generating new UUID: {new_uuid}")
                config_data["agent_uuid"] = new_uuid
                config_updated = True
            
            # Save updated configuration if changes were made
            if config_updated:
                try:
                    with open(self.config_path, "w") as f:
                        json.dump(config_data, f, indent=4)
                    logger.info(f"Successfully saved configuration with new Agent UUID to {self.config_path}")
                except Exception as e:
                    logger.error(f"Failed to save configuration with new Agent UUID: {str(e)}")
                    if self.ui_manager:
                        self.ui_manager.show_error(
                            "Configuration Error", 
                            f"Failed to save configuration update:\n{self.config_path}\n\nError: {e}"
                        )
            
            self.config = config_data
            return config_data
        
        # No valid configuration found, create a new one using UI
        logger.warning("Configuration file not found or invalid. Proceeding with first-time setup dialog.")
        
        if not self.ui_manager:
            logger.error("Cannot create a new configuration: UI Manager not provided")
            return None
            
        # Request configuration from user
        new_config = self.ui_manager.request_config_setup()
        
        if not new_config:
            logger.error("No configuration provided during setup. Exiting.")
            return None
            
        # Add agent_uuid to the newly created config
        new_uuid = str(uuid.uuid4())
        logger.info(f"Generating Agent UUID for new configuration: {new_uuid}")
        new_config["agent_uuid"] = new_uuid
        
        # Validate the new configuration
        if self.ui_manager:
            self.ui_manager.update_status("Validating Config...")
            
        status, message, details = self.validate_config(new_config, is_update=False)
        
        if status != "valid":
            logger.error(f"Initial configuration validation failed: {message} (Details: {details})")
            
            if self.ui_manager:
                choice = self.ui_manager.show_question(
                    "Configuration Error", 
                    f"The provided configuration is invalid and cannot be used:\n\n{message}\n\n"
                    "What would you like to do?",
                    options=["Try Again", "Exit Application"]
                )
                
                if choice == "Exit Application":
                    logger.warning("User chose to exit application during initial configuration.")
                    return None
                    
                # If "Try Again" selected, recursively call this method
                return self.load_or_create_config()
            else:
                return None
                
        # Save valid configuration to file
        try:
            with open(self.config_path, "w") as f:
                json.dump(new_config, f, indent=4)
            logger.info(f"Successfully saved new configuration to {self.config_path}")
            self.config = new_config
            return new_config
            
        except Exception as e:
            logger.error(f"Failed to save new configuration: {str(e)}")
            if self.ui_manager:
                self.ui_manager.show_error("Configuration Error", f"Failed to save new configuration:\n{self.config_path}\n\nError: {e}")
            return None
    
    def update_config(self):
        """
        Updates the configuration through UI dialog and validation
        
        Returns:
            bool: True if configuration was successfully updated, False otherwise
        """
        if not self.ui_manager:
            logger.error("Cannot update configuration: UI Manager not provided")
            return False
            
        logger.info("User requested configuration update")
        
        # Store original config to revert if needed
        original_config = self.config.copy() if self.config else {}
        
        # Request configuration update from user
        new_config = self.ui_manager.request_config_update(self.config)
        
        if not new_config:
            logger.info("Configuration update canceled by user")
            if self.ui_manager:
                self.ui_manager.update_status("Config Update Canceled")
            return False
            
        # Preserve agent_uuid in the new config
        if "agent_uuid" in self.config:
            logger.info(f"Preserving existing agent UUID during config update: {self.config['agent_uuid']}")
            new_config["agent_uuid"] = self.config["agent_uuid"]
        else:
            # Generate a new UUID if it was somehow missing before update
            new_uuid = str(uuid.uuid4())
            logger.warning(f"Agent UUID missing during update. Generating new UUID: {new_uuid}")
            new_config["agent_uuid"] = new_uuid
        
        # Validate the new configuration
        if self.ui_manager:
            self.ui_manager.update_status("Validating Config...")
            
        status, message, details = self.validate_config(new_config, is_update=True)
        
        if status != "valid":
            logger.error(f"Configuration validation failed: {message} (Details: {details})")
            
            # Check if the current configuration still works
            original_config_works = self.can_connect_with_config(self.config)
            
            if original_config_works and self.ui_manager:
                # Offer options: retry or keep original config
                retry = self.ui_manager.show_question(
                    "Configuration Error", 
                    f"The provided configuration is invalid:\n\n{message}\n\n"
                    "Your current configuration is still working.\n\n"
                    "Would you like to try configuring again?",
                    options=["Try Again", "Cancel Update"]
                )
                
                if retry == "Try Again":
                    # Recursively call this method for retry
                    return self.update_config()
                else:
                    logger.info("User chose to keep the current working configuration.")
                    if self.ui_manager:
                        self.ui_manager.update_status("Config Update Canceled")
                    return False
                    
            elif self.ui_manager:
                # Current config doesn't work either
                choice = self.ui_manager.show_question(
                    "Configuration Error", 
                    f"The provided configuration is invalid:\n\n{message}\n\n"
                    "Your current configuration is not working either.\n\n"
                    "What would you like to do?",
                    options=["Try Again", "Exit Application"]
                )
                
                if choice == "Exit Application":
                    logger.warning("User chose to exit application due to configuration issues.")
                    return None
                    
                # Recursively call for retry
                return self.update_config()
            else:
                return False
                
        # Update config in memory and save to file
        self.config = new_config
        
        try:
            os.makedirs(os.path.dirname(self.config_path), exist_ok=True)
            with open(self.config_path, "w") as f:
                json.dump(self.config, f, indent=4)
            logger.info(f"Configuration updated and saved successfully to {self.config_path}")
            if self.ui_manager:
                self.ui_manager.update_status("Config Updated")
            return True
            
        except Exception as e:
            logger.error(f"Error saving updated config: {e}")
            if self.ui_manager:
                self.ui_manager.show_error("Error", f"Failed to save configuration: {str(e)}")
            return False
    
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
            
            # Construct test URL
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
            
            # Set a timeout for the connection test
            if self.ui_manager:
                self.ui_manager.update_status("Validating Config...")
                
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
    
    def can_connect_with_config(self, config):
        """
        Tests if the provided configuration can successfully connect to the server.
        
        Args:
            config (dict): Configuration to test
            
        Returns:
            bool: True if the configuration works, False otherwise
        """
        logger.info("Testing connection with provided configuration...")
        if not config:
            logger.error("No configuration available to test")
            return False
            
        status, _, _ = self.validate_config(config, is_update=True)
        return status == "valid"
        
    def get_config(self):
        """
        Returns the current configuration.
        
        Returns:
            dict: The current configuration or None if not loaded
        """
        return self.config
        
    def get_agent_uuid(self):
        """
        Returns the agent UUID from the current configuration.
        
        Returns:
            str: The agent UUID or None if not available
        """
        if not self.config:
            return None
            
        return self.config.get("agent_uuid")
        
    def get_api_url(self):
        """
        Returns the API URL constructed from the server link in configuration.
        
        Returns:
            str: API URL or None if config not available
        """
        if not self.config:
            return None
            
        server_link = self.config.get("server_link", "").strip()
        if not server_link:
            return None
            
        return f"{server_link}/api/agent"
        
    def get_websocket_url(self):
        """
        Returns the WebSocket URL constructed from the server link in configuration.
        
        Returns:
            str: WebSocket URL or None if config not available
        """
        if not self.config:
            return None
            
        server_link = self.config.get("server_link", "").strip()
        if not server_link:
            return None
            
        server_protocol = "wss" if server_link.startswith("https") else "ws"
        return f'{server_protocol}://{server_link.split("://")[1]}/ws'
        
    def set_ui_manager(self, ui_manager):
        """
        Sets the UI manager for displaying dialogs.
        
        Args:
            ui_manager: The UI manager instance
        """
        self.ui_manager = ui_manager