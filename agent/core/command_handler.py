# Standard library imports
import json
import os
import threading
import time

# Third-party library imports
import websocket

# Local application imports
import agent.core.helper.choco_handle as choco_handle
import agent.core.helper.file_handle as file_handle
import agent.core.helper.system_info as system_info
from agent.core.utils.logger import info, error, warning
import queue


class CommandHandler:
    def __init__(self, computer_id, config):
        self.computer_id = computer_id
        self.config = config
        self.ws = None
        # Determine protocol based on server_link
        server_protocol = "wss" if self.config["server_link"].startswith("https") else "ws"
        # Fix the WebSocket path to use '/ws' instead of '/websocket'
        self.ws_url = f'{server_protocol}://{self.config["server_link"].split("://")[1]}/ws'
        self.task_queue = queue.Queue()
        self.worker_thread = threading.Thread(target=self._process_tasks, daemon=True)
        self.worker_thread.start()

    def _process_tasks(self):
        while True:
            try:
                task = self.task_queue.get()
                if task is None:
                    break
                func, args, callback = task
                try:
                    result = func(*args)
                    if callback:
                        callback(True, result)
                except Exception as e:
                    if callback:
                        callback(False, str(e))
            except Exception:
                continue

    def _execute_heavy_task(self, func, *args, command_type=None, task_id=None):
        def callback(success, result):
            if self.ws:
                response = {
                    "type": "task_completed",
                    "command_type": command_type,
                    "task_id": task_id,
                    "success": success and result[0],
                    "message": (
                        result[1] if not success else f"Task completed successfully"
                    ),
                    "data": result if success else None,
                }
                info("\n" + "=" * 30)
                info(f"[TASK COMPLETED] {command_type}")
                info(f"[SUCCESS] {success and result[0]}")
                info(f"[MESSAGE] {response['message']}")
                if success:
                    info(f"[DATA] {response['data']}")
                info("=" * 30 + "\n")
                self.ws.send(json.dumps(response))

        self.task_queue.put((func, args, callback))

    def handle_message(self, ws, message):
        try:
            data = json.loads(message)
            info("\n" + "=" * 30)
            info(f"[COMMAND] {data.get('type', 'unknown')}")
            info(f"[PARAMS] {data.get('params')}")
            if data.get("type") == "welcome":
                info("[STATUS] Connected to server")
                return

            command_type = data.get("command_type", data.get("type"))
            info(f"[EXECUTING] {command_type} with params: {data.get('params')}")

            response = None
            response = self.handle_command(command_type, data.get("params"))
            if response:
                response = {
                    "type": "response",
                    "command_type": command_type,
                    "success": response["success"],
                    "message": response["message"],
                    "data": response.get("data"),
                }
                info(
                    f"[STATUS] {'Success' if response['success'] else 'Failed'}"
                )

            if response:
                ws.send(json.dumps(response))
            info("=" * 30 + "\n")

        except json.JSONDecodeError:
            error("\n[ERROR] Invalid JSON message")
        except Exception as e:
            error("\n[ERROR] " + str(e))
            ws.send(json.dumps({"type": "error", "message": str(e)}))

    def on_error(self, ws, error):
        warning(f"WebSocket Error: {str(error)}")

    def on_close(self, ws, close_status_code, close_msg):
        warning("WebSocket connection closed")
        time.sleep(5)
        self.start_websocket()

    def on_open(self, ws):
        info("WebSocket connection established")
        try:
            auth_message = {"type": "auth", "computer_id": self.computer_id}
            ws.send(json.dumps(auth_message))
        except Exception as e:
            error(f"Failed to send auth message: {str(e)}")

    def start_websocket(self):
        websocket.enableTrace(False)

        while True:
            try:
                # Extract the server domain from server_link instead of using server_ip
                server_domain = self.config["server_link"].split("://")[1].split("/")[0]
                headers = {"Origin": f"http://{server_domain}"}

                self.ws = websocket.WebSocketApp(
                    self.ws_url,
                    header=headers,
                    on_message=self.handle_message,
                    on_error=self.on_error,
                    on_close=self.on_close,
                    on_open=self.on_open,
                    subprotocols=["agent-protocol"],
                )

                info(f"[AGENT] Connecting to {self.ws_url}...")
                self.ws.run_forever(
                    skip_utf8_validation=True,
                    ping_interval=30,
                    ping_timeout=10,
                    reconnect=5,
                )

            except Exception as e:
                error("[ERROR] WebSocket connection failed: " + str(e))
                time.sleep(5)

    def handle_command(self, command_type, params=None):
        try:
            if command_type == "get_system_info":
                system_info_data = system_info.get_system_info()
                return {
                    "success": True,
                    "message": "System info retrieved",
                    "data": system_info_data,
                }

            elif command_type == "get_process_list":
                processes = system_info.get_process_list()
                return {
                    "success": True,
                    "message": "Process list retrieved",
                    "data": processes,
                }

            elif command_type == "get_network_connections":
                # Handle as a heavy task to avoid blocking the WebSocket
                task_id = params.get("task_id") if params else None
                info(f"Starting network connections retrieval with task_id: {task_id}")
                
                # Define a wrapper function that returns a tuple result
                def get_network_connections_wrapped():
                    try:
                        connections = system_info.get_network_connections()
                        return True, "Network connections retrieved", connections
                    except Exception as e:
                        error(f"Failed to get network connections: {str(e)}")
                        return False, f"Failed to get network connections: {str(e)}", None
                
                self._execute_heavy_task(
                    get_network_connections_wrapped,
                    command_type=command_type,
                    task_id=task_id,
                )
                return {
                    "success": True,
                    "message": "Network connections retrieval started",
                    "data": {"status": "wait", "task_id": task_id},
                }

            elif command_type == "install_application":
                if not params or "name" not in params:
                    return {"success": False, "message": "Application name is required"}

                app_name = params.get("name")
                version = params.get("version")
                task_id = params.get("task_id")

                info(f"Installing {app_name} with version {version}")

                self._execute_heavy_task(
                    choco_handle.install_package,
                    app_name,
                    version,
                    command_type=command_type,
                    task_id=task_id,
                )
                return {
                    "success": True,
                    "message": f"Installation of {app_name} started",
                    "data": {"status": "wait", "task_id": task_id},
                }

            elif command_type == "uninstall_application":
                if not params or "name" not in params:
                    return {"success": False, "message": "Application name is required"}

                app_name = params.get("name")
                task_id = params.get("task_id")

                self._execute_heavy_task(
                    choco_handle.uninstall_package,
                    app_name,
                    command_type=command_type,
                    task_id=task_id,
                )
                return {
                    "success": True,
                    "message": f"Uninstallation of {app_name} started",
                    "data": {"status": "wait", "task_id": task_id},
                }

            elif command_type == "install_file":
                if not params or "link" not in params:
                    return {"success": False, "message": "File path is required"}

                task_id = params.get("task_id")
                self._execute_heavy_task(
                    file_handle.install_file,
                    self.config["server_link"],
                    params.get("name"),
                    params.get("link"),
                    command_type=command_type,
                    task_id=task_id,
                )
                return {
                    "success": True,
                    "message": f"Installation of {params.get('name')} started",
                    "data": {"status": "wait", "task_id": task_id},
                }

            elif command_type == "remove_file":
                if not params or "name" not in params:
                    return {"success": False, "message": "File name is required"}

                file_name = params.get("name")
                success, message = file_handle.remove_file(file_name)
                return {"success": success, "message": message}

            else:
                return {"success": False, "message": f"Unknown command: {command_type}"}

        except Exception as e:
            return {"success": False, "message": f"Error executing command: {str(e)}"}
