import json
import threading
import time
import queue

import websocket

import agent.core.helper.choco_handle as choco_handle
import agent.core.helper.file_handle as file_handle
import agent.core.helper.system_info as system_info
from agent.core.utils.logger import info, error, warning


class CommandHandler:
    def __init__(self, computer_id, config):
        self.computer_id = computer_id
        self.config = config
        self.agent_uuid = config.get("agent_uuid")
        self.ws = None
        server_protocol = "wss" if self.config["server_link"].startswith("https") else "ws"
        self.ws_url = f'{server_protocol}://{self.config["server_link"].split("://")[1]}/ws'
        self.task_queue = queue.Queue()
        self.worker_thread = threading.Thread(target=self._process_tasks, daemon=True)
        self.worker_thread.start()
        info(f"CommandHandler initialized for computer_id: {computer_id}, agent_uuid: {self.agent_uuid}")

    def _process_tasks(self):
        info("Task processing worker thread started.")
        while True:
            try:
                task = self.task_queue.get()
                if task is None:
                    info("Task processing worker thread received stop signal.")
                    break
                func, args, callback = task
                info(f"Processing task: {func.__name__}")
                try:
                    result = func(*args)
                    if callback:
                        callback(True, result)
                    info(f"Task {func.__name__} completed successfully.")
                except Exception as e:
                    error(f"Error executing task {func.__name__}: {e}")
                    if callback:
                        callback(False, str(e))
            except Exception as e:
                error(f"Unexpected error in task processing loop: {e}")
                continue
        info("Task processing worker thread stopped.")

    def _execute_heavy_task(self, func, *args, command_type=None, task_id=None):
        def callback(success, result):
            if self.ws:
                response = {
                    "type": "task_completed",
                    "command_type": command_type,
                    "task_id": task_id,
                    "success": success,
                    "message": (
                        result[1] if isinstance(result, tuple) and len(result) > 1 and not success
                        else f"Task '{command_type}' completed { 'successfully' if success else 'with errors' }"
                    ),
                    "data": result if success else None,
                }
                info("\n" + "=" * 30)
                info(f"[TASK COMPLETED] {command_type} (Task ID: {task_id})")
                info(f"[SUCCESS] {success}")
                info(f"[MESSAGE] {response['message']}")
                if success and response['data']:
                    info(f"[DATA TYPE] {type(response['data']).__name__}")
                elif not success:
                    info(f"[ERROR DETAILS] {result}")
                info("=" * 30 + "\n")
                try:
                    self.ws.send(json.dumps(response))
                    info(f"Sent task completion status for {command_type} (Task ID: {task_id})")
                except Exception as send_error:
                    error(f"Failed to send task completion status for {command_type} (Task ID: {task_id}): {send_error}")
            else:
                warning(f"Cannot send task completion for {command_type} (Task ID: {task_id}): WebSocket is not connected.")

        info(f"Queuing heavy task: {func.__name__} (Task ID: {task_id}, Command: {command_type})")
        self.task_queue.put((func, args, callback))

    def handle_message(self, ws, message):
        try:
            data = json.loads(message)
            info("\n" + "=" * 30)
            info(f"[RECV COMMAND] Type: {data.get('type', 'unknown')}")
            info(f"[PARAMS] {data.get('params')}")

            if data.get("type") == "welcome":
                info("[STATUS] Received welcome message from server")
                return

            command_type = data.get("command_type", data.get("type"))
            task_id = data.get("params", {}).get("task_id")
            info(f"[EXECUTING] Command: {command_type}, Task ID: {task_id}")

            response_data = self.handle_command(command_type, data.get("params"))

            if response_data:
                response = {
                    "type": "response",
                    "command_type": command_type,
                    "task_id": task_id,
                    "success": response_data.get("success", False),
                    "message": response_data.get("message", ""),
                    "data": response_data.get("data"),
                }
                info(
                    f"[SEND RESPONSE] Command: {command_type}, Task ID: {task_id}, Success: {response['success']}"
                )
                try:
                    ws.send(json.dumps(response))
                except Exception as send_error:
                     error(f"Failed to send immediate response for {command_type} (Task ID: {task_id}): {send_error}")

            info("=" * 30 + "\n")

        except json.JSONDecodeError:
            error("[ERROR] Invalid JSON message received")
            try:
                ws.send(json.dumps({"type": "error", "message": "Invalid JSON format"}))
            except Exception as send_error:
                 error(f"Failed to send JSON error response: {send_error}")
        except Exception as e:
            error(f"[ERROR] Exception in handle_message: {e}")
            try:
                ws.send(json.dumps({"type": "error", "message": f"An internal error occurred: {e}"}))
            except Exception as send_error:
                 error(f"Failed to send generic error response: {send_error}")

    def on_error(self, ws, error_obj):
        error_message = str(error_obj) if error_obj else "Unknown WebSocket error"
        error(f"WebSocket Error: {error_message}")

    def on_close(self, ws, close_status_code, close_msg):
        warning(f"WebSocket connection closed. Status: {close_status_code}, Message: {close_msg}")
        self.ws = None
        info("Attempting to reconnect in 5 seconds...")
        time.sleep(5)
        reconnect_thread = threading.Thread(target=self.start_websocket)
        reconnect_thread.daemon = True
        reconnect_thread.start()

    def on_open(self, ws):
        info("WebSocket connection established.")
        self.ws = ws
        try:
            auth_message = {
                "type": "auth", 
                "computer_id": self.computer_id,
                "agent_uuid": self.agent_uuid
            }
            info(f"Sending authentication message with computer_id: {self.computer_id} and agent_uuid: {self.agent_uuid}")
            ws.send(json.dumps(auth_message))
        except Exception as e:
            error(f"Failed to send auth message: {e}")

    def start_websocket(self):
        websocket.enableTrace(False)
        info(f"Attempting to connect to WebSocket: {self.ws_url}")
        while True:
            try:
                link_parts = self.config["server_link"].split("://")
                domain_part = link_parts[1].split("/")[0] if len(link_parts) > 1 else link_parts[0].split("/")[0]
                origin_proto = "http" if self.config["server_link"].startswith("http:") else "https"
                headers = {"Origin": f"{origin_proto}://{domain_part}"}

                self.ws = websocket.WebSocketApp(
                    self.ws_url,
                    header=headers,
                    on_message=self.handle_message,
                    on_error=self.on_error,
                    on_close=self.on_close,
                    on_open=self.on_open,
                    subprotocols=["agent-protocol"],
                )

                info(f"Starting WebSocket connection to {self.ws_url}")
                self.ws.run_forever(
                    skip_utf8_validation=True,
                    ping_interval=30,
                    ping_timeout=10,
                )
                warning("WebSocket run_forever loop exited. Reconnection handled by on_close.")
                break

            except websocket.WebSocketException as wse:
                 error(f"WebSocket connection exception: {wse}")
            except Exception as e:
                error(f"Unexpected error in WebSocket connection loop: {e}")

            info("Waiting 5 seconds before retrying connection...")
            time.sleep(5)

    def handle_command(self, command_type, params=None):
        params = params or {}
        task_id = params.get("task_id")
        info(f"Handling command: {command_type}, Task ID: {task_id}")

        try:
            if command_type == "get_system_info":
                system_info_data = system_info.get_system_info()
                info("Retrieved system info.")
                return {
                    "success": True,
                    "message": "System info retrieved successfully.",
                    "data": system_info_data,
                }

            elif command_type == "get_process_list":
                processes = system_info.get_process_list()
                info("Retrieved process list.")
                return {
                    "success": True,
                    "message": "Process list retrieved successfully.",
                    "data": processes,
                }

            elif command_type == "get_network_connections":
                info(f"Queueing task for network connections retrieval (Task ID: {task_id})")
                def get_network_connections_wrapped():
                    try:
                        connections = system_info.get_network_connections()
                        info(f"Network connections retrieved successfully (Task ID: {task_id}).")
                        return True, "Network connections retrieved successfully.", connections
                    except Exception as e:
                        error(f"Failed to get network connections (Task ID: {task_id}): {e}")
                        return False, f"Failed to get network connections: {e}", None

                self._execute_heavy_task(
                    get_network_connections_wrapped,
                    command_type=command_type,
                    task_id=task_id,
                )
                return None

            elif command_type == "install_application":
                app_name = params.get("name")
                if not app_name:
                    error(f"Missing application name for install_application (Task ID: {task_id})")
                    return {"success": False, "message": "Application name parameter ('name') is required"}

                version = params.get("version")
                info(f"Queueing task for installing {app_name} (Version: {version or 'latest'}, Task ID: {task_id})")

                self._execute_heavy_task(
                    choco_handle.install_package,
                    app_name,
                    version,
                    command_type=command_type,
                    task_id=task_id,
                )
                return None

            elif command_type == "uninstall_application":
                app_name = params.get("name")
                if not app_name:
                     error(f"Missing application name for uninstall_application (Task ID: {task_id})")
                     return {"success": False, "message": "Application name parameter ('name') is required"}

                info(f"Queueing task for uninstalling {app_name} (Task ID: {task_id})")
                self._execute_heavy_task(
                    choco_handle.uninstall_package,
                    app_name,
                    command_type=command_type,
                    task_id=task_id,
                )
                return None

            elif command_type == "install_file":
                file_link = params.get("link")
                file_name = params.get("name")
                if not file_link:
                    error(f"Missing file link for install_file (Task ID: {task_id})")
                    return {"success": False, "message": "File link parameter ('link') is required"}

                info(f"Queueing task for installing file from {file_link} (Name: {file_name}, Task ID: {task_id})")
                self._execute_heavy_task(
                    file_handle.install_file,
                    self.config["server_link"],
                    file_name,
                    file_link,
                    command_type=command_type,
                    task_id=task_id,
                )
                return None

            else:
                warning(f"Received unknown command type: {command_type} (Task ID: {task_id})")
                return {"success": False, "message": f"Unknown command type: {command_type}"}

        except Exception as e:
            error(f"Error handling command '{command_type}' (Task ID: {task_id}): {e}")
            return {
                "success": False,
                "message": f"An internal error occurred while handling command '{command_type}': {e}",
            }

    def stop(self):
        info("Stopping CommandHandler...")
        self.task_queue.put(None)
        info("Waiting for worker thread to finish...")
        self.worker_thread.join(timeout=2)
        if self.worker_thread.is_alive():
             warning("Worker thread did not stop gracefully within timeout.")
        else:
             info("Worker thread stopped successfully.")

        if self.ws:
            try:
                info("Closing WebSocket connection...")
                self.ws.close()
                info("WebSocket connection closed.")
            except Exception as e:
                error(f"Error closing WebSocket: {e}")
        else:
            info("WebSocket was not connected.")

        info("CommandHandler stopped.")
