import os
import json
import socket
import time
import threading
import platform
import choco_handle
import requests
import system_info
import sys
from agent_ui import SetupDialog, show_error, show_warning, show_info


class RealAgent:
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

    def handle_command(self, command):
        print(f"Received command: {command}")
        try:
            cmd_data = json.loads(command)
            cmd_type = cmd_data.get("type")
            cmd_params = cmd_data.get("params", {})

            if cmd_type == "get_process_list":
                processes = system_info.get_process_list()
                return json.dumps({"processes": processes})

            elif cmd_type == "get_network_connections":
                connections = system_info.get_network_connections()
                return json.dumps({"connections": connections})

            elif cmd_type == "install_application":
                app_name = cmd_params.get("name")
                version = cmd_params.get("version")
                success, message = choco_handle.install_package(app_name, version)
                return json.dumps({"success": success, "message": message})

            elif cmd_type == "uninstall_application":
                app_name = cmd_params.get("name")
                success, message = choco_handle.uninstall_package(app_name)
                return json.dumps({"success": success, "message": message})

            elif cmd_type == "list_applications":
                success, applications = choco_handle.list_installed_packages()
                if success and applications:
                    return json.dumps({"applications": applications})
                return json.dumps({"applications": []})

            return json.dumps({"error": "Unknown command"})
        except json.JSONDecodeError:
            return json.dumps({"error": "Invalid JSON command"})

    def start_command_server(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.bind(("0.0.0.0", 5000))
        server.listen(1)

        while True:
            client, addr = server.accept()
            data = client.recv(1024).decode()
            response = self.handle_command(data)
            client.send(response.encode())
            client.close()

    def connect_to_server(self):
        sys_info = system_info.get_system_info(
            self.room_id, self.row_index, self.column_index
        )

        success, application_list = choco_handle.list_installed_packages()
        if success:
            if type(application_list) == list:
                sys_info["applications"] = application_list
            else:
                show_warning("Application List Warning", application_list)

        try:
            response = requests.post(
                f"{self.api_url}/connect",
                json=system_info.get_system_info(
                    self.room_id, self.row_index, self.column_index
                ),
            )
            data = response.json()
            if "error" in data:
                show_error("Connection Error", data["error"])
                return False
            self.computer_id = data["id"]
            print(f"Connected successfully. Computer ID: {self.computer_id}")
            return True
        except Exception as e:
            show_error("Connection Error", str(e))
            return False

    def send_heartbeat(self):
        while True:
            try:
                response = requests.post(
                    f"{self.api_url}/heartbeat", json={"computer_id": self.computer_id}
                )
            except Exception as e:
                show_warning("Heartbeat Warning", str(e))

            time.sleep(30)

    def run(self):
        if self.connect_to_server():
            cmd_thread = threading.Thread(target=self.start_command_server)
            cmd_thread.daemon = True
            cmd_thread.start()

            heartbeat_thread = threading.Thread(target=self.send_heartbeat)
            heartbeat_thread.daemon = True
            heartbeat_thread.start()

            while True:
                time.sleep(1)


if __name__ == "__main__":
    agent = RealAgent()
    agent.run()
