# agent/core/agent_core.py
import os
import sys
import threading
import platform
import agent.core.utils.logger as logger

# Import SRP-compliant components
from agent.core.platform.instance_manager import InstanceManager
from agent.core.config.config_manager import ConfigManager
from agent.core.initializer import AgentInitializer
from agent.core.network.server_connector import ServerConnector
from agent.core.network.websocket_connection import WebSocketConnection
from agent.core.command.command_dispatcher import CommandDispatcher
from agent.core.ui.ui_manager import UIManager
from agent.core.ui.system_tray import SystemTrayIcon

class Agent:
    """
    Main agent class that orchestrates components following the Single
    Responsibility Principle (SRP). Each component has a specific
    responsibility and the agent coordinates them.
    """
    
    def __init__(self):
        """Initialize the agent and its components"""
        # Check platform compatibility
        if platform.system() != 'Windows':
            logger.error("This agent only runs on Windows. Exiting.")
            sys.exit(1)
            
        # Initialize components in dependency order
        self.init_components()
        
    def init_components(self):
        """Initialize all agent components"""
        # UI Manager (created first so other components can use it for UI interactions)
        self.ui_manager = UIManager()
        
        # System Tray (creates the system tray icon)
        self.system_tray = SystemTrayIcon(
            update_config_callback=self.update_config,
            register_startup_callback=self.register_startup,
            unregister_startup_callback=self.unregister_startup
        )
        self.ui_manager.set_system_tray(self.system_tray)
        
        # Instance Manager (handles single instance enforcement)
        self.instance_manager = InstanceManager()
        self.instance_manager.set_cleanup_callback(self.cleanup)
        
        # Configuration Manager (loads/saves config)
        self.config_manager = ConfigManager(self.ui_manager)
        
        # Agent Initializer (handles setup tasks)
        self.initializer = AgentInitializer(self.ui_manager)
        
        # Server Connector (handles server API communication)
        self.server_connector = ServerConnector(self.config_manager, self.ui_manager)
        
        # WebSocket and Command handling (initialized later after connection)
        self.websocket = None
        self.command_dispatcher = None
        
    def run(self):
        """Main execution flow of the agent"""
        # Start system tray
        self.system_tray.start()
        self.ui_manager.update_status("Initializing...")
        logger.info("Agent starting...")
        
        # Check if we should exit (another instance is running)
        instance_status = self.instance_manager.handle_instance_management()
        if instance_status == "EXIT_SIGNALED":
            logger.info("Another instance is running, exiting.")
            sys.exit(0)
        elif instance_status == "ERROR":
            logger.error("Error initializing instance management, exiting.")
            sys.exit(1)
            
        # Load configuration
        self.ui_manager.update_status("Loading Config...")
        config = self.config_manager.load_or_create_config()
        if not config:
            logger.error("Failed to load or create configuration. Exiting.")
            sys.exit(1)
            
        # Run initialization steps
        self.ui_manager.update_status("Initializing...")
        init_result = self.initializer.initialize()
        
        if not init_result["success"]:
            logger.error(f"Initialization failed: {init_result['message']}")
            self.ui_manager.show_error("Initialization Error", init_result["message"])
            if init_result["requires_admin"]:
                logger.info("Admin rights required for initialization. Exiting.")
                sys.exit(1)
                
        # Connect to server
        self.ui_manager.update_status("Connecting...")
        logger.info("Attempting to connect to server...")
        
        if not self.server_connector.connect_to_server():
            logger.error("Failed to establish initial connection to server.")
            self.ui_manager.update_status("Connection Failed (Initial)")
            # Continue execution but with limited functionality
        else:
            logger.info("Server connection successful, updating file and application lists...")
            self.server_connector.update_file_and_application_lists()
            
            # Initialize and start WebSocket connection
            self.start_websocket_handler()
            
        logger.info("Agent initialization complete. Entering main loop.")
        
        # Enter main loop (this will block until the agent is closed)
        try:
            # Using a threading Event to wait for shutdown signal
            stop_event = threading.Event()
            self.stop_event = stop_event
            
            # Wait for shutdown signal
            stop_event.wait()
            logger.info("Stop signal received for main loop.")
            
        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt received. Initiating shutdown.")
            
        finally:
            logger.info("Exiting main loop. Performing cleanup...")
            self.cleanup()
            
        logger.info("Agent shutdown complete.")
        
    def start_websocket_handler(self):
        """Initializes and starts the WebSocket handler"""
        computer_id = self.server_connector.get_computer_id()
        agent_uuid = self.config_manager.get_agent_uuid()
        
        if not computer_id:
            logger.error("Cannot start WebSocket handler without computer ID.")
            self.ui_manager.update_status("Error: No ID")
            return
            
        if not agent_uuid:
            logger.error("Cannot start WebSocket handler without Agent UUID.")
            self.ui_manager.update_status("Error: No Agent UUID")
            return
            
        logger.info(f"Starting WebSocket handler with computer_id: {computer_id} and agent_uuid: {agent_uuid}")
        self.ui_manager.update_status("Starting WebSocket...")
        
        # Initialize WebSocket connection
        self.websocket = WebSocketConnection(
            self.config_manager,
            computer_id,
            agent_uuid
        )
        
        # Initialize command dispatcher with the WebSocket
        self.command_dispatcher = CommandDispatcher(
            self.websocket,
            self.config_manager
        )
        
        # Start the WebSocket connection
        self.websocket.start()
        
        # Start the command dispatcher
        self.command_dispatcher.start()
        
        logger.info("WebSocket and command handler started.")
        
    def cleanup(self, is_relaunching=False):
        """
        Performs graceful shutdown of agent components
        
        Args:
            is_relaunching (bool): Whether the agent is being restarted
        """
        logger.info(f"Starting cleanup sequence... (Relaunching: {is_relaunching})")
        
        # Stop Command Handler and WebSocket
        if hasattr(self, 'command_dispatcher') and self.command_dispatcher:
            logger.info("Stopping Command Dispatcher...")
            try:
                self.command_dispatcher.stop()
                logger.info("Command Dispatcher stopped.")
            except Exception as e:
                logger.error(f"Error stopping Command Dispatcher: {e}")
                
        if hasattr(self, 'websocket') and self.websocket:
            logger.info("Stopping WebSocket connection...")
            try:
                self.websocket.stop()
                logger.info("WebSocket connection stopped.")
            except Exception as e:
                logger.error(f"Error stopping WebSocket connection: {e}")
                
        # Release instance handles
        if hasattr(self, 'instance_manager'):
            logger.info("Stopping Instance Manager...")
            try:
                self.instance_manager.stop()
                logger.info("Instance Manager stopped.")
            except Exception as e:
                logger.error(f"Error stopping Instance Manager: {e}")
                
        # Stop system tray (unless relaunching)
        if hasattr(self, 'system_tray') and not is_relaunching:
            logger.info("Stopping system tray...")
            try:
                self.system_tray.stop()
                logger.info("System tray stopped.")
            except Exception as e:
                logger.error(f"Error stopping system tray: {e}")
                
        # Signal main loop to exit if it's waiting
        if hasattr(self, 'stop_event'):
            self.stop_event.set()
            
        logger.info("Cleanup sequence finished.")
        
    def update_config(self):
        """Update configuration via UI (callback for system tray)"""
        if self.config_manager.update_config():
            # Configuration updated, reconnect
            logger.info("Configuration updated. Reconnecting...")
            
            # Stop existing connections
            if self.command_dispatcher:
                self.command_dispatcher.stop()
                
            if self.websocket:
                self.websocket.stop()
                
            # Reconnect to server with new configuration
            self.ui_manager.update_status("Reconnecting...")
            if self.server_connector.connect_to_server():
                logger.info("Server connection successful, updating file and application lists...")
                self.server_connector.update_file_and_application_lists()
                
                # Start new WebSocket connection
                self.start_websocket_handler()
                
                logger.info("Reconnection completed successfully.")
                
    def register_startup(self):
        """Register the application to start at boot (callback for system tray)"""
        return self.initializer.register_startup()
        
    def unregister_startup(self):
        """Unregister the application from starting at boot (callback for system tray)"""
        return self.initializer.unregister_startup()
        
    def __del__(self):
        """Destructor as a fallback cleanup"""
        logger.warning("Agent destructor (__del__) called. Performing fallback cleanup.")
        if hasattr(self, 'instance_manager'):
            self.instance_manager.release_instance_handles()