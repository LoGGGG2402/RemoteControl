import os
import json
import time
import threading
import platform
import choco_handle
import requests  # type: ignore
import system_info
import sys
import subprocess
from agent_ui import SetupDialog, show_error, show_info
from command_handler import CommandHandler
import win32event  # type: ignore
import win32api  # type: ignore
import winerror  # type: ignore


class Agent:
    def __init__(self):
        if platform.system() != "Windows":
            show_error("System Error", "This agent only runs on Windows systems.")
            sys.exit(1)

        # Tạo Windows Named Mutex để chống chạy nhiều instance
        mutex_name = "Global\\RemoteControlAgent"
        try:
            self.mutex = win32event.CreateMutex(None, 1, mutex_name)
            if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
                show_error(
                    "Agent Error", "Another instance of the agent is already running."
                )
                sys.exit(1)
        except Exception as e:
            show_error("Mutex Error", f"Failed to create mutex: {str(e)}")
            sys.exit(1)

        self.server_host = "localhost"
        self.server_port = 3000
        self.computer_id = None
        self.config = self.load_or_create_config()
        self.api_url = f"http://{self.config['server_ip']}:3000/api/agent"
        self.room_name = self.config["room_name"]
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
        while True:
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

                    if error_code in [
                        "ROOM_NOT_FOUND",
                        "INVALID_ROW_INDEX",
                        "INVALID_COLUMN_INDEX",
                        "POSITION_OCCUPIED",
                    ]:
                        show_error("Configuration Error", error_message)

                        # Hiển thị dialog cấu hình lại
                        dialog = SetupDialog()
                        new_config = dialog.get_result()
                        if not new_config:
                            continue

                        # Cập nhật config mới
                        self.config.update(new_config)
                        config_path = os.path.join(
                            os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
                        )
                        with open(config_path, "w") as f:
                            json.dump(self.config, f)

                        # Cập nhật các thuộc tính
                        self.room_name = self.config["room_name"]
                        self.row_index = self.config["row_index"]
                        self.column_index = self.config["column_index"]
                        continue
                    else:
                        show_error("Unknown Error", error_message)
                        return False

                self.computer_id = data["id"]
                print(f"Connected successfully. Computer ID: {self.computer_id}")
                return True

            except requests.exceptions.ConnectionError:
                show_error(
                    "Connection Error",
                    f"Could not connect to server at {self.api_url}. Please check if server is running and IP is correct.",
                )

                # Cho phép người dùng nhập lại IP server
                dialog = SetupDialog()
                new_config = dialog.get_result()
                if not new_config:
                    continue

                self.config.update(new_config)
                config_path = os.path.join(
                    os.getenv("APPDATA"), "RemoteControl", "agent_config.json"
                )
                with open(config_path, "w") as f:
                    json.dump(self.config, f)
                continue

            except Exception as e:
                show_error("Connection Error", str(e))
                return False

    def run(self):
        if self.connect_to_server():
            self.command_handler = CommandHandler(self.computer_id, self.config)
            command_thread = threading.Thread(
                target=self.command_handler.start_websocket
            )
            command_thread.daemon = True
            command_thread.start()

            while True:
                time.sleep(1)


if __name__ == "__main__":
    agent = Agent()
    agent.run()
