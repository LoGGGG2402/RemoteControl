import socket
import json
import time
import random
import threading
import requests


class FakeAgent:
    def __init__(self):
        self.server_host = "localhost"
        self.server_port = 5000
        self.api_url = "http://localhost:3000/api/agent"
        self.computer_id = None
        self.room_id = 1  # Fake room ID
        self.row_index = 2  # Fake position
        self.column_index = 2  # Fake position
        self.applications = ["notepadplusplus", "vscode"]

    def get_system_info(self):
        return {
            "room_id": self.room_id,
            "row_index": self.row_index,
            "column_index": self.column_index,
            "ip_address": "192.168.1.100",
            "mac_address": "00:11:22:33:44:55",
            "hostname": "fake-computer",
            "applications": self.applications,
        }

    def handle_command(self, command):
        if command.startswith("get_process_list"):
            processes = [{"name": f"process_{i}", "pid": i} for i in range(5)]
            return json.dumps({"processes": processes})

        elif command.startswith("get_network_connections"):
            connections = [
                {
                    "local": f"192.168.1.100:{random.randint(1000,9999)}",
                    "remote": f"172.16.0.{random.randint(1,255)}:80",
                    "state": "ESTABLISHED",
                }
                for _ in range(3)
            ]
            return json.dumps({"connections": connections})

        elif command.startswith("install_application"):
            app_name = command.split(" ")[1]
            if app_name not in self.applications:
                self.applications.append(app_name)
            return json.dumps({"success": True, "message": f"Installed {app_name}"})

        return json.dumps({"error": "Unknown command"})

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
        try:
            response = requests.post(
                f"{self.api_url}/connect", json=self.get_system_info()
            )
            print(response.text)
            data = response.json()
            if "error" in data:
                print(f"Connection failed: {data['error']}")
                return False
            self.computer_id = data["id"]
            print(f"Connected successfully. Computer ID: {self.computer_id}")
            return True
        except Exception as e:
            print(f"Connection failed: {e}")
            return False

    def send_heartbeat(self):
        while True:
            try:
                response = requests.post(
                    f"{self.api_url}/heartbeat", json={"computer_id": self.computer_id}
                )
                print("Heartbeat sent successfully")
            except Exception as e:
                print(f"Heartbeat failed: {e}")

            time.sleep(30)  # Send heartbeat every 30 seconds

    def run(self):
        if self.connect_to_server():
            # Start command server in a separate thread
            # cmd_thread = threading.Thread(target=self.start_command_server)
            # cmd_thread.daemon = True
            # cmd_thread.start()

            # Start heartbeat in a separate thread
            heartbeat_thread = threading.Thread(target=self.send_heartbeat)
            heartbeat_thread.daemon = True
            heartbeat_thread.start()

            # Keep main thread alive
            while True:
                time.sleep(1)


if __name__ == "__main__":
    agent = FakeAgent()
    agent.run()
