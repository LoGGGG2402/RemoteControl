# agent/core/command/command_dispatcher.py
import json
import agent.core.utils.logger as logger
from agent.core.command.task_executor import TaskExecutor
import agent.core.helper.system_info as system_info
import agent.core.helper.choco_handle as choco_handle
import agent.core.helper.file_handle as file_handle

class CommandDispatcher:
    """
    Responsible for handling incoming commands from WebSocket connection,
    dispatching them to appropriate handlers, and sending responses.
    """
    
    def __init__(self, websocket_connection, config_manager):
        """
        Initialize CommandDispatcher
        
        Args:
            websocket_connection: WebSocketConnection instance for communication
            config_manager: ConfigManager instance for accessing configuration
        """
        self.websocket = websocket_connection
        self.config_manager = config_manager
        self.task_executor = TaskExecutor(self._on_task_completed)
        
        # Register the message handler with the WebSocket
        self.websocket.message_handler = self.handle_message
        
    def start(self):
        """Start the command dispatcher and task executor"""
        self.task_executor.start()
        logger.info("CommandDispatcher started")
        
    def handle_message(self, ws, message):
        """
        Handle incoming messages from WebSocket
        
        Args:
            ws: WebSocket instance
            message: Raw message string from WebSocket
        """
        try:
            data = json.loads(message)
            
            logger.info("\n" + "=" * 30)
            logger.info(f"[RECV COMMAND] Type: {data.get('type', 'unknown')}")
            logger.info(f"[PARAMS] {data.get('params')}")
            
            # Handle welcome message separately
            if data.get("type") == "welcome":
                logger.info("[STATUS] Received welcome message from server")
                return
                
            # Extract command type and task ID
            command_type = data.get("command_type", data.get("type"))
            params = data.get("params", {})
            task_id = params.get("task_id")
            
            logger.info(f"[EXECUTING] Command: {command_type}, Task ID: {task_id}")
            
            # Process the command
            response_data = self.handle_command(command_type, params)
            
            # Send response if available (immediate response)
            if response_data:
                response = {
                    "type": "response",
                    "command_type": command_type,
                    "task_id": task_id,
                    "success": response_data.get("success", False),
                    "message": response_data.get("message", ""),
                    "data": response_data.get("data"),
                }
                
                logger.info(
                    f"[SEND RESPONSE] Command: {command_type}, Task ID: {task_id}, Success: {response['success']}"
                )
                
                try:
                    self.websocket.send(response)
                except Exception as send_error:
                    logger.error(f"Failed to send immediate response for {command_type} (Task ID: {task_id}): {send_error}")
                    
            logger.info("=" * 30 + "\n")
            
        except json.JSONDecodeError:
            logger.error("[ERROR] Invalid JSON message received")
            try:
                self.websocket.send({"type": "error", "message": "Invalid JSON format"})
            except Exception as send_error:
                logger.error(f"Failed to send JSON error response: {send_error}")
                
        except Exception as e:
            logger.error(f"[ERROR] Exception in handle_message: {e}")
            try:
                self.websocket.send({"type": "error", "message": f"An internal error occurred: {e}"})
            except Exception as send_error:
                logger.error(f"Failed to send generic error response: {send_error}")
                
    def handle_command(self, command_type, params=None):
        """
        Process a specific command based on its type
        
        Args:
            command_type: Type of command to process
            params: Parameters for the command (optional)
            
        Returns:
            dict or None: Response data for immediate response or None for async tasks
        """
        params = params or {}
        task_id = params.get("task_id")
        logger.info(f"Handling command: {command_type}, Task ID: {task_id}")
        
        try:
            # Map command types to handler methods
            command_handlers = {
                "get_system_info": self._handle_get_system_info,
                "get_process_list": self._handle_get_process_list,
                "get_network_connections": self._handle_get_network_connections,
                "install_application": self._handle_install_application,
                "uninstall_application": self._handle_uninstall_application,
                "install_file": self._handle_install_file
            }
            
            # Execute handler if available
            if command_type in command_handlers:
                handler = command_handlers[command_type]
                return handler(params)
            else:
                # Unknown command
                logger.warning(f"Received unknown command type: {command_type} (Task ID: {task_id})")
                return {
                    "success": False,
                    "message": f"Unknown command type: {command_type}"
                }
                
        except Exception as e:
            logger.error(f"Error handling command '{command_type}' (Task ID: {task_id}): {e}")
            return {
                "success": False,
                "message": f"An internal error occurred while handling command '{command_type}': {e}",
            }
            
    def _handle_get_system_info(self, params):
        """Handle get_system_info command"""
        system_info_data = system_info.get_system_info()
        logger.info("Retrieved system info.")
        
        return {
            "success": True,
            "message": "System info retrieved successfully.",
            "data": system_info_data,
        }
        
    def _handle_get_process_list(self, params):
        """Handle get_process_list command"""
        processes = system_info.get_process_list()
        logger.info("Retrieved process list.")
        
        return {
            "success": True,
            "message": "Process list retrieved successfully.",
            "data": processes,
        }
        
    def _handle_get_network_connections(self, params):
        """Handle get_network_connections command (async)"""
        task_id = params.get("task_id")
        logger.info(f"Queueing task for network connections retrieval (Task ID: {task_id})")
        
        # Queue heavy task
        self.task_executor.queue_task(
            system_info.get_network_connections,
            command_type="get_network_connections",
            task_id=task_id
        )
        
        # Async task, no immediate response
        return None
        
    def _handle_install_application(self, params):
        """Handle install_application command (async)"""
        app_name = params.get("name")
        task_id = params.get("task_id")
        
        if not app_name:
            logger.error(f"Missing application name for install_application (Task ID: {task_id})")
            return {
                "success": False, 
                "message": "Application name parameter ('name') is required"
            }
            
        version = params.get("version")
        logger.info(f"Queueing task for installing {app_name} (Version: {version or 'latest'}, Task ID: {task_id})")
        
        # Queue heavy task
        self.task_executor.queue_task(
            choco_handle.install_package,
            args=(app_name, version),
            command_type="install_application",
            task_id=task_id
        )
        
        # Async task, no immediate response
        return None
        
    def _handle_uninstall_application(self, params):
        """Handle uninstall_application command (async)"""
        app_name = params.get("name")
        task_id = params.get("task_id")
        
        if not app_name:
            logger.error(f"Missing application name for uninstall_application (Task ID: {task_id})")
            return {
                "success": False, 
                "message": "Application name parameter ('name') is required"
            }
            
        logger.info(f"Queueing task for uninstalling {app_name} (Task ID: {task_id})")
        
        # Queue heavy task
        self.task_executor.queue_task(
            choco_handle.uninstall_package,
            args=(app_name,),
            command_type="uninstall_application",
            task_id=task_id
        )
        
        # Async task, no immediate response
        return None
        
    def _handle_install_file(self, params):
        """Handle install_file command (async)"""
        file_link = params.get("link")
        file_name = params.get("name")
        task_id = params.get("task_id")
        
        if not file_link:
            logger.error(f"Missing file link for install_file (Task ID: {task_id})")
            return {
                "success": False, 
                "message": "File link parameter ('link') is required"
            }
            
        logger.info(f"Queueing task for installing file from {file_link} (Name: {file_name}, Task ID: {task_id})")
        
        # Get server link from config
        server_link = self.config_manager.get_config().get("server_link")
        
        # Queue heavy task
        self.task_executor.queue_task(
            file_handle.install_file,
            args=(server_link, file_name, file_link),
            command_type="install_file",
            task_id=task_id
        )
        
        # Async task, no immediate response
        return None
        
    def _on_task_completed(self, success, result, command_type, task_id):
        """
        Callback when an async task completes
        
        Args:
            success: Whether the task was successful
            result: Result data from the task
            command_type: Type of command that was executed
            task_id: Task ID for tracking
        """
        if not self.websocket:
            logger.warning(f"Cannot send task completion for {command_type} (Task ID: {task_id}): WebSocket is not connected.")
            return
            
        # Create response message
        response = {
            "type": "task_completed",
            "command_type": command_type,
            "task_id": task_id,
            "success": success,
            "message": (
                result[1] if isinstance(result, tuple) and len(result) > 1 and not success
                else f"Task '{command_type}' completed {'successfully' if success else 'with errors'}"
            ),
            "data": result if success else None,
        }
        
        # Log task completion
        logger.info("\n" + "=" * 30)
        logger.info(f"[TASK COMPLETED] {command_type} (Task ID: {task_id})")
        logger.info(f"[SUCCESS] {success}")
        logger.info(f"[MESSAGE] {response['message']}")
        
        if success and response['data']:
            logger.info(f"[DATA TYPE] {type(response['data']).__name__}")
        elif not success:
            logger.info(f"[ERROR DETAILS] {result}")
            
        logger.info("=" * 30 + "\n")
        
        # Send response
        try:
            self.websocket.send(response)
            logger.info(f"Sent task completion status for {command_type} (Task ID: {task_id})")
        except Exception as send_error:
            logger.error(f"Failed to send task completion status for {command_type} (Task ID: {task_id}): {send_error}")
            
    def stop(self):
        """Stop the command dispatcher and its components"""
        logger.info("Stopping CommandDispatcher...")
        
        # Stop task executor
        if self.task_executor:
            self.task_executor.stop()
            
        logger.info("CommandDispatcher stopped.")