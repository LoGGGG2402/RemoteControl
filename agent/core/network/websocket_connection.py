# agent/core/network/websocket_connection.py
import time
import threading
import json
import websocket
import agent.core.utils.logger as logger

class WebSocketConnection:
    """
    Responsible for managing the WebSocket connection to the server.
    Handles connection establishment, reconnection, and message passing.
    """
    
    def __init__(self, config_manager, computer_id, agent_uuid, message_handler=None):
        """
        Initialize WebSocket connection handler
        
        Args:
            config_manager: ConfigManager instance to get configuration
            computer_id: Computer ID from server connection
            agent_uuid: Agent UUID for authentication
            message_handler: Function to handle incoming messages (optional)
        """
        self.config_manager = config_manager
        self.computer_id = computer_id
        self.agent_uuid = agent_uuid
        self.message_handler = message_handler
        self.ws = None
        self.is_connected = False
        self.is_stopping = False
        self.reconnect_thread = None
        self.ws_url = self.config_manager.get_websocket_url()
        
    def start(self):
        """
        Start the WebSocket connection
        
        Returns:
            bool: True if connection started, False if error in configuration
        """
        if not self.ws_url:
            logger.error("Cannot start WebSocket: Invalid server URL")
            return False
            
        if not self.computer_id:
            logger.error("Cannot start WebSocket: No computer ID")
            return False
            
        if not self.agent_uuid:
            logger.error("Cannot start WebSocket: No agent UUID")
            return False
            
        self.is_stopping = False
        
        # Start WebSocket in a separate thread to not block
        connection_thread = threading.Thread(
            target=self._connect_websocket,
            daemon=True
        )
        connection_thread.start()
        
        logger.info(f"WebSocket connection thread started for {self.ws_url}")
        return True
        
    def _connect_websocket(self):
        """Internal method to establish WebSocket connection with reconnection logic"""
        websocket.enableTrace(False)
        logger.info(f"Attempting to connect to WebSocket: {self.ws_url}")
        
        while not self.is_stopping:
            try:
                # Extract domain for Origin header
                config = self.config_manager.get_config()
                link_parts = config["server_link"].split("://")
                domain_part = link_parts[1].split("/")[0] if len(link_parts) > 1 else link_parts[0].split("/")[0]
                origin_proto = "http" if config["server_link"].startswith("http:") else "https"
                headers = {"Origin": f"{origin_proto}://{domain_part}"}
                
                # Set up WebSocket with callbacks
                self.ws = websocket.WebSocketApp(
                    self.ws_url,
                    header=headers,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                    on_open=self._on_open,
                    subprotocols=["agent-protocol"],
                )
                
                logger.info(f"Starting WebSocket connection to {self.ws_url}")
                
                # Run WebSocket loop with keep-alive
                self.ws.run_forever(
                    skip_utf8_validation=True,
                    ping_interval=30,
                    ping_timeout=10,
                )
                
                logger.warning("WebSocket run_forever loop exited. Reconnection handled by on_close.")
                break
                
            except websocket.WebSocketException as wse:
                logger.error(f"WebSocket connection exception: {wse}")
            except Exception as e:
                logger.error(f"Unexpected error in WebSocket connection loop: {e}")
                
            # Don't retry if stopping
            if self.is_stopping:
                logger.info("WebSocket connection loop stopping as requested.")
                break
                
            logger.info("Waiting 5 seconds before retrying connection...")
            time.sleep(5)
            
    def _on_open(self, ws):
        """Callback when WebSocket connection is opened"""
        logger.info("WebSocket connection established.")
        self.is_connected = True
        
        try:
            # Send authentication message
            auth_message = {
                "type": "auth", 
                "computer_id": self.computer_id,
                "agent_uuid": self.agent_uuid
            }
            logger.info(f"Sending authentication message with computer_id: {self.computer_id} and agent_uuid: {self.agent_uuid}")
            ws.send(json.dumps(auth_message))
        except Exception as e:
            logger.error(f"Failed to send auth message: {e}")
            
    def _on_message(self, ws, message):
        """Callback when message is received"""
        if self.message_handler:
            self.message_handler(ws, message)
        else:
            logger.warning("Received WebSocket message but no handler is registered")
            
    def _on_error(self, ws, error_obj):
        """Callback when error occurs in WebSocket"""
        error_message = str(error_obj) if error_obj else "Unknown WebSocket error"
        logger.error(f"WebSocket Error: {error_message}")
        self.is_connected = False
        
    def _on_close(self, ws, close_status_code, close_msg):
        """Callback when WebSocket connection is closed"""
        logger.warning(f"WebSocket connection closed. Status: {close_status_code}, Message: {close_msg}")
        self.is_connected = False
        self.ws = None
        
        # Don't reconnect if stopping
        if self.is_stopping:
            logger.info("WebSocket closed, not reconnecting as stopping was requested.")
            return
            
        logger.info("Attempting to reconnect in 5 seconds...")
        
        # Start reconnection in a new thread
        if not self.reconnect_thread or not self.reconnect_thread.is_alive():
            self.reconnect_thread = threading.Thread(target=self._reconnect)
            self.reconnect_thread.daemon = True
            self.reconnect_thread.start()
            
    def _reconnect(self):
        """Handle reconnection after connection loss"""
        time.sleep(5)  # Wait before reconnecting
        
        if self.is_stopping:
            logger.info("Reconnection cancelled as stopping was requested.")
            return
            
        logger.info("Reconnecting to WebSocket...")
        self._connect_websocket()
        
    def send(self, message):
        """
        Send a message through the WebSocket
        
        Args:
            message: Message object to send (will be JSON-encoded)
            
        Returns:
            bool: True if message was sent, False otherwise
        """
        if not self.ws or not self.is_connected:
            logger.warning("Cannot send message: WebSocket is not connected")
            return False
            
        try:
            if isinstance(message, dict):
                message_str = json.dumps(message)
            elif isinstance(message, str):
                message_str = message
            else:
                message_str = json.dumps({"data": str(message)})
                
            self.ws.send(message_str)
            return True
            
        except Exception as e:
            logger.error(f"Error sending WebSocket message: {e}")
            return False
            
    def stop(self):
        """Stop the WebSocket connection"""
        logger.info("Stopping WebSocket connection...")
        self.is_stopping = True
        
        if self.ws:
            try:
                logger.info("Closing WebSocket connection...")
                self.ws.close()
                logger.info("WebSocket connection closed.")
            except Exception as e:
                logger.error(f"Error closing WebSocket: {e}")
        else:
            logger.info("WebSocket was not connected.")
            
        # Wait for reconnect thread to finish if it's running
        if self.reconnect_thread and self.reconnect_thread.is_alive():
            logger.info("Waiting for reconnect thread to finish...")
            self.reconnect_thread.join(timeout=2)
            
            if self.reconnect_thread.is_alive():
                logger.warning("Reconnect thread did not stop within timeout.")
                
        self.is_connected = False
        logger.info("WebSocket connection stopped.")