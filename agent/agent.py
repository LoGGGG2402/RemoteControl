import os
import json
import time
import threading
import platform
import choco_handle
import requests
import system_info
import sys
from agent_ui import SetupDialog, show_error, show_warning, show_info
from websocket_handler import WebSocketHandler


class Agent:
    def __init__(self):
        if platform.system() != "Windows":
            show_error("System Error", "This agent only runs on Windows systems.")
            sys.exit(1)

        self.server_host = "localhost"
        self.server_port = 3000
        self.computer_id = None
        self.config = self.load_or_create_config()
        self.api_url = f"http://{self.config['server_ip']}:3000/api/agent"
        self.room_id = self.config["room_id"]
        self.row_index = self.config["row_index"]
        self.column_index = self.config["column_index"]
        self.ws_handler = None

    def load_or_create_config(self):
        config_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl")
        if not os.path.exists(config_dir):

            # Install Chocolatey for first time setup
            success, message = choco_handle.install_chocolatey()
            if not success:
                show_error(
                    "Installation Error", f"Failed to install Chocolatey: {message}"
                )
                sys.exit(1)
            show_info("Installation Status", message)
            os.makedirs(config_dir)
        config_path = os.path.join(config_dir, "agent_config.json")

        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                return json.load(f)

        print("First time setup required...")
        dialog = SetupDialog()
        config = dialog.get_result()
        if not config:
            sys.exit(1)

        with open(config_path, "w") as f:
            json.dump(config, f)

        return config

    def connect_to_server(self):
        try:
            server_ip = self.config["server_ip"].strip().replace("%20", "")
            self.api_url = f"http://{server_ip}:3000/api/agent"

            sys_info = system_info.get_system_info()
            sys_info.update(
                {
                    "room_name": self.config["room_name"],
                    "row_index": self.config["row_index"],
                    "column_index": self.config["column_index"],
                }
            )

            response = requests.post(
                f"{self.api_url}/connect", json=sys_info, timeout=5
            )
            data = response.json()

            if "error" in data:
                error_message = data["error"]
                error_code = data.get("code", "UNKNOWN_ERROR")

                if error_code == "ROOM_NOT_FOUND":
                    show_error(
                        "Configuration Error",
                        f"Room '{self.config['room_name']}' not found. Please check room name.",
                    )
                elif error_code == "INVALID_ROW_INDEX":
                    show_error("Configuration Error", error_message)
                elif error_code == "INVALID_COLUMN_INDEX":
                    show_error("Configuration Error", error_message)
                elif error_code == "POSITION_OCCUPIED":
                    show_error(
                        "Configuration Error",
                        "This position is already taken by another computer.",
                    )
                else:
                    show_error("Connection Error", error_message)
                return False

            self.computer_id = data["id"]
            print(f"Connected successfully. Computer ID: {self.computer_id}")
            return True

        except requests.exceptions.ConnectionError:
            show_error(
                "Connection Error",
                f"Could not connect to server at {self.api_url}. Please check if server is running and IP is correct.",
            )
            return False
        except Exception as e:
            show_error("Connection Error", str(e))
            return False

    def run(self):
        if self.connect_to_server():
            self.ws_handler = WebSocketHandler(self.computer_id, self.config)
            ws_thread = threading.Thread(target=self.ws_handler.start_websocket)
            ws_thread.daemon = True
            ws_thread.start()

            while True:
                time.sleep(1)


if __name__ == "__main__":
    agent = Agent()
    agent.run()
