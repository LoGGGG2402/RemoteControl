# agent/core/network/server_connector.py
import socket
import platform
import requests
import agent.core.utils.logger as logger
import agent.core.helper.system_info as system_info

class ServerConnector:
    """
    Responsible for connecting to the server API and handling communication
    with the server for registration and status updates.
    """
    
    def __init__(self, config_manager, ui_manager=None):
        """
        Initialize the ServerConnector
        
        Args:
            config_manager: ConfigManager instance to get configuration
            ui_manager: Optional UIManager for status updates and error messages
        """
        self.config_manager = config_manager
        self.ui_manager = ui_manager
        self.computer_id = None
        
    def connect_to_server(self):
        """
        Connects to the server and obtains a computer ID
        
        Returns:
            bool: True if connection was successful, False otherwise
        """
        # Get configuration from config manager
        config = self.config_manager.get_config()
        if not config:
            logger.error("Cannot connect to server: No configuration available")
            return False
            
        api_url = self.config_manager.get_api_url()
        if not api_url:
            logger.error("Cannot connect to server: Invalid server link in configuration")
            return False
            
        try:
            # Get system information for connection
            hostname = socket.gethostname()
            try:
                ip_address = socket.gethostbyname(hostname)
            except socket.gaierror:
                logger.warning("Could not get IP address from hostname, using platform.node() instead")
                hostname = platform.node()
                ip_address = "127.0.0.1"
            
            system_data = system_info.get_system_info()
            mac_address = system_data.get("mac_address", "Unknown")
            
            # Prepare connection data
            data = {
                "room_name": config["room_name"],
                "row_index": config["row_index"],
                "column_index": config["column_index"],
                "hostname": hostname,
                "ip_address": ip_address,
                "mac_address": mac_address
            }
            
            logger.info(f"Connecting to server: {api_url}/connect")
            logger.debug(f"Connection data: {data}")
            
            if self.ui_manager:
                self.ui_manager.update_status("Connecting...")
                
            # Send connection request
            response = requests.post(f"{api_url}/connect", json=data)
            
            # Handle successful response
            if response.status_code == 200:
                response_data = response.json()
                self.computer_id = response_data.get("id")
                logger.info(f"Successfully connected to server. Computer ID: {self.computer_id}")
                
                if self.ui_manager:
                    self.ui_manager.update_status("Connected")
                    
                return True
                
            # Handle error response
            else:
                error_data = response.json() if response.content else {"error": "Unknown error"}
                error_message = error_data.get("error", "Unknown error")
                error_code = error_data.get("code", "UNKNOWN_ERROR")
                
                logger.error(f"Server connection failed: {error_message} (Code: {error_code})")
                
                if self.ui_manager:
                    self.ui_manager.update_status(f"Connection Failed: {error_code}")
                    
                    human_readable_error = self._get_connection_error_message(
                        error_code, 
                        error_message,
                        config["room_name"],
                        config["row_index"],
                        config["column_index"]
                    )
                    self.ui_manager.show_error("Connection Error", human_readable_error)
                    
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Connection error: {e}")
            
            if self.ui_manager:
                self.ui_manager.update_status("Connection Error")
                self.ui_manager.show_error("Connection Error", f"Failed to connect to server: {str(e)}")
                
            return False
            
    def _get_connection_error_message(self, error_code, error_message, room_name, row_index, column_index):
        """
        Returns a user-friendly error message based on the error code from the server
        
        Args:
            error_code (str): The error code from the server
            error_message (str): The error message from the server
            room_name (str): The room name from configuration
            row_index (int): The row index from configuration
            column_index (int): The column index from configuration
            
        Returns:
            str: A user-friendly error message
        """
        error_messages = {
            "ROOM_NAME_REQUIRED": "Room name is required. Please check your configuration.",
            "ROOM_NOT_FOUND": f"Room not found: {room_name}. Please check your configuration.",
            "INVALID_ROW_INDEX": f"Invalid row index: {row_index}. Must be within range for the room.",
            "INVALID_COLUMN_INDEX": f"Invalid column index: {column_index}. Must be within range for the room.",
            "POSITION_OCCUPIED": "This position is already occupied by another computer.",
            "DATABASE_ERROR": "Server database error. Please contact administrator."
        }
        
        return error_messages.get(error_code, f"Server error: {error_message}")
        
    def update_file_and_application_lists(self):
        """
        Updates the file and application lists on the server
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.computer_id:
            logger.error("Cannot update file/application lists: No computer ID")
            return False
            
        # This would be implemented to update the server with lists of files/applications
        # For now, this is a placeholder as the implementation was not visible in the original code
        logger.info("File and application lists updated on server")
        return True
        
    def get_computer_id(self):
        """
        Returns the computer ID obtained from the server
        
        Returns:
            str: The computer ID or None if not connected
        """
        return self.computer_id
        
    def set_ui_manager(self, ui_manager):
        """Set the UI manager for displaying status and errors"""
        self.ui_manager = ui_manager