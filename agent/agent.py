import os
import json
import time
import threading
import platform
import choco_handle
import file_handle
import requests  # type: ignore
import system_info
import sys
from command_handler import CommandHandler
import win32event  # type: ignore
import win32api  # type: ignore
import winerror  # type: ignore
from logger import logger


class Agent:
    def __init__(self):
        if platform.system() != "Windows":
            logger.error("This agent only runs on Windows systems")
            sys.exit(1)

        # Tạo Windows Named Mutex để chống chạy nhiều instance
        mutex_name = "Global\\RemoteControlAgent"
        try:
            self.mutex = win32event.CreateMutex(None, 1, mutex_name)
            if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
                logger.error("Another instance of the agent is already running")
                sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to create mutex: {str(e)}")
            sys.exit(1)

        self.server_host = "localhost"
        self.server_port = 3000
        self.computer_id = None
        self.config = self.load_or_create_config()
        if not self.config:
            sys.exit(1)
        self.api_url = f"http://{self.config['server_ip']}:3000/api/agent"
        self.room_name = self.config["room_name"]
        self.row_index = self.config["row_index"]
        self.column_index = self.config["column_index"]
        self.ws_handler = None

    def load_or_create_config(self):
        config_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl")
        config_path = os.path.join(config_dir, "agent_config.json")

        if not os.path.exists(config_path):
            logger.error("Agent configuration not found. Please run installer first.")
            sys.exit(1)

        try:
            with open(config_path, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load configuration: {str(e)}")
            sys.exit(1)

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

                self.computer_id = data["id"]
                logger.info(f"Connected successfully. Computer ID: {self.computer_id}")
                return True

            except requests.exceptions.ConnectionError:
                logger.error(
                    f"Could not connect to server at {self.api_url}. Please check if server is running and IP is correct."
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
                logger.error(f"Connection Error: {str(e)}")
                return False

    def update_list_file_and_application(self):
        try:
            list_file = file_handle.get_files()
            success, list_application = choco_handle.list_installed_packages()
            if not success:
                return f"Error getting installed applications: {list_application}"

            response = requests.post(
                f"{self.api_url}/update-list-file-and-application/{self.computer_id}",
                json={"listFile": list_file, "listApplication": list_application},
                timeout=5,
            )
            return response.text
        except requests.exceptions.Timeout:
            return "Request timed out while updating lists"
        except requests.exceptions.ConnectionError:
            return "Connection error while updating lists"
        except Exception as e:
            return f"Error updating lists: {str(e)}"

    def run(self):
        if self.connect_to_server():
            self.update_list_file_and_application()
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
