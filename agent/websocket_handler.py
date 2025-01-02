import json
import time
import websocket  # type: ignore
from agent_ui import show_error, show_warning
import subprocess
import system_info
import choco_handle


class WebSocketHandler:
    def __init__(self, computer_id, config):
        self.computer_id = computer_id
        self.config = config
        self.ws = None
        self.ws_url = f"ws://{self.config['server_ip']}:3000/ws"

    def handle_message(self, ws, message):
        try:
            data = json.loads(message)
            print("\n" + "=" * 30)
            print(f"[COMMAND] {data.get('type', 'unknown')}")
            print(f"[PARAMS] {data.get('params')}")
            if data.get("type") == "welcome":
                print("[STATUS] Connected to server")
                return

            command_type = data.get("command_type", data.get("type"))
            print(f"[EXECUTING] {command_type} with params: {data.get('params')}")

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
                print(f"[STATUS] {'Success' if response['success'] else 'Failed'}")

            if response:
                ws.send(json.dumps(response))
            print("=" * 30 + "\n")

        except json.JSONDecodeError:
            print("\n[ERROR] Invalid JSON message")
        except Exception as e:
            print("\n[ERROR]", str(e))
            ws.send(json.dumps({"type": "error", "message": str(e)}))

    def on_error(self, ws, error):
        show_warning("WebSocket Error", str(error))

    def on_close(self, ws, close_status_code, close_msg):
        show_warning("Connection Closed", "WebSocket connection closed")
        time.sleep(5)  # Đợi 5 giây trước khi thử kết nối lại
        self.start_websocket()

    def on_open(self, ws):
        print("WebSocket connection established")
        try:
            auth_message = {"type": "auth", "computer_id": self.computer_id}
            ws.send(json.dumps(auth_message))
        except Exception as e:
            show_error("WebSocket Error", f"Failed to send auth message: {str(e)}")

    def start_websocket(self):
        websocket.enableTrace(False)

        while True:
            try:
                headers = {"Origin": f"http://{self.config['server_ip']}:3000"}

                self.ws = websocket.WebSocketApp(
                    self.ws_url,
                    header=headers,
                    on_message=self.handle_message,
                    on_error=self.on_error,
                    on_close=self.on_close,
                    on_open=self.on_open,
                    subprotocols=["agent-protocol"],
                )

                print(f"[AGENT] Connecting to {self.ws_url}...")
                self.ws.run_forever(
                    skip_utf8_validation=True,
                    ping_interval=30,
                    ping_timeout=10,
                    reconnect=5,
                )

            except Exception as e:
                print("[ERROR] WebSocket connection failed:", str(e))
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
                connections = system_info.get_network_connections()
                return {
                    "success": True,
                    "message": "Network connections retrieved",
                    "data": connections,
                }

            elif command_type == "install_application":
                if not params or "name" not in params:
                    return {"success": False, "message": "Application name is required"}

                app_name = params["name"]
                version = params.get("version")

                result = choco_handle.install_package(app_name, version)
                return {
                    "success": result[0],
                    "message": result[1],
                }

            elif command_type == "uninstall_application":
                if not params or "name" not in params:
                    return {"success": False, "message": "Application name is required"}

                app_name = params["name"]
                result = choco_handle.uninstall_package(app_name)
                return {
                    "success": result[0],
                    "message": result[1],
                }

            else:
                return {"success": False, "message": f"Unknown command: {command_type}"}

        except Exception as e:
            return {"success": False, "message": f"Error executing command: {str(e)}"}
