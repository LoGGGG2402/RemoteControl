import json
import time
import websocket
from agent_ui import show_error, show_warning


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

            if data.get("type") == "welcome":
                print("[STATUS] Connected to server")
                return

            command_type = data.get("command_type", data.get("type"))
            print(f"[EXECUTING] {command_type}")

            response = None
            if command_type == "get_process_list":
                processes = system_info.get_process_list()
                response = {
                    "type": "response",
                    "command_type": command_type,
                    "data": processes,
                }
                print("[STATUS] Success")

            elif command_type == "get_network_connections":
                connections = system_info.get_network_connections()
                response = {
                    "type": "response",
                    "command_type": command_type,
                    "data": connections,
                }
                print("[STATUS] Success")

            elif command_type == "install_application":
                app_name = params.get("name")
                success, message = choco_handle.install_package(
                    app_name, params.get("version")
                )
                response = {
                    "type": "response",
                    "command_type": command_type,
                    "success": success,
                    "message": message,
                }
                print(f"[STATUS] {'Success' if success else 'Failed'}")

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
