import os
import sys
import base64
import tempfile
import subprocess
import shutil
import requests
from urllib3.util.retry import Retry
from requests.adapters import HTTPAdapter
from agent import system_info, choco_handle
import ctypes
import json
from agent.installer_ui import SetupDialog
from agent.logger import info, error, warning
import time
import codecs
import psutil


# Đọc file agent.exe và mã hóa thành base64
ENCODED_AGENT_DATA = None


def get_agent_file():
    info("Lấy dữ liệu agent đã được mã hóa...")
    try:
        if ENCODED_AGENT_DATA is None:
            error("Không tìm thấy dữ liệu agent đã được mã hóa!")
            sys.exit(1)

        info("Lấy dữ liệu thành công!")
        return ENCODED_AGENT_DATA

    except Exception as e:
        error(f"Lỗi khi lấy dữ liệu agent: {e}")
        error(f"Chi tiết lỗi: {str(e.__class__)}")
        sys.exit(1)


class AgentInstaller:
    def __init__(self):
        self.install_dir = "C:/Program Files/RemoteControl"
        self.agent_data = get_agent_file()

    def check_admin(self):
        try:
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
            info(f"Kiểm tra quyền admin: {is_admin}")
            return is_admin
        except Exception as e:
            error(f"Lỗi khi kiểm tra quyền admin: {e}")
            return False

    def extract_agent(self):
        """Giải mã và lưu agent.exe"""
        if not os.path.exists(self.install_dir):
            os.makedirs(self.install_dir)

        agent_path = os.path.join(self.install_dir, "agent.exe")
        with open(agent_path, "wb") as f:
            f.write(base64.b64decode(self.agent_data))
        return agent_path

    def install_service(self):
        """Cài đặt agent như một scheduled task chạy khi khởi động"""
        try:
            info("=== BẮT ĐẦU CÀI ĐẶT AGENT ===")

            # Kiểm tra và tạo thư mục cài đặt
            if not os.path.exists(self.install_dir):
                os.makedirs(self.install_dir)

            agent_path = os.path.join(self.install_dir, "agent.exe")

            # Dừng tất cả các instance đang chạy
            subprocess.run(
                ["taskkill", "/F", "/IM", "agent.exe"], capture_output=True, check=False
            )
            time.sleep(2)

            # Xóa task cũ nếu tồn tại
            subprocess.run(
                ["schtasks", "/Delete", "/TN", "RemoteControlAgent", "/F"],
                capture_output=True,
                check=False,
            )
            time.sleep(2)

            # Tạo scheduled task mới
            try:
                info("Đang tạo scheduled task...")
                cmd = [
                    "schtasks",
                    "/Create",
                    "/TN",
                    "RemoteControlAgent",
                    "/TR",
                    f'"{agent_path}"',
                    "/SC",
                    "ONSTART",  # Chạy khi khởi động
                    "/RL",
                    "HIGHEST",  # Chạy với quyền cao nhất
                    "/F",  # Ghi đè nếu tồn tại
                    "/NP",  # Không yêu cầu mật khẩu
                    "/RU",
                    "SYSTEM",  # Chạy dưới tài khoản SYSTEM
                ]

                result = subprocess.run(cmd, capture_output=True, text=True)
                if result.returncode != 0:
                    error(f"Lỗi khi tạo task: {result.stderr}")
                    return False

                # Khởi động agent trong một tiến trình riêng biệt
                info("Khởi động agent...")
                startupinfo = subprocess.STARTUPINFO()
                startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                startupinfo.wShowWindow = subprocess.SW_HIDE

                # Sử dụng CREATE_NEW_PROCESS_GROUP và CREATE_NO_WINDOW
                process = subprocess.Popen(
                    [agent_path],
                    startupinfo=startupinfo,
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
                    | subprocess.CREATE_NO_WINDOW,
                    close_fds=True,
                    shell=False,
                )

                # Ngắt kết nối với tiến trình cha
                process.wait(timeout=1)

                # Kiểm tra agent đã chạy chưa
                time.sleep(5)
                running = False
                for proc in psutil.process_iter(["name", "ppid"]):
                    if (
                        proc.info["name"] == "agent.exe"
                        and proc.info["ppid"] != os.getpid()
                    ):
                        running = True
                        break

                if running:
                    info("Agent đã được cài đặt và khởi động thành công!")
                    return True
                else:
                    error("Không thể khởi động agent!")
                    return False

            except Exception as e:
                error(f"Lỗi khi tạo scheduled task: {str(e)}")
                return False

        except Exception as e:
            error(f"Lỗi trong quá trình cài đặt: {str(e)}")
            return False

    def run(self):
        """Chạy quá trình cài đặt"""
        try:
            if not self.check_admin():
                error("Cần quyền Administrator để cài đặt!")
                error("Vui lòng chạy lại chương trình với quyền Administrator")
                input("\nNhấn Enter để thoát...")
                sys.exit(1)

            print("Đang cài đặt Remote Control Agent...")

            # Xóa và tạo lại thư mục cài đặt
            if os.path.exists(self.install_dir):
                try:
                    shutil.rmtree(self.install_dir)
                except Exception as e:
                    error(f"Không thể xóa thư mục cũ: {e}")
                    sys.exit(1)

            os.makedirs(self.install_dir, exist_ok=True)

            # Hiển thị dialog cấu hình
            print("\nCấu hình agent...")
            dialog = SetupDialog()
            config = dialog.get_result()
            if not config:
                warning("Hủy cài đặt.")
                return False

            # try connect to server with config
            print("\nĐang kết nối đến server...")
            while True:
                try:
                    server_ip = config["server_ip"].strip().replace("%20", "")
                    api_url = f"http://{server_ip}:3000/api/agent"

                    sys_info = system_info.get_system_info()
                    sys_info.update(
                        {
                            "room_name": config["room_name"],
                            "row_index": config["row_index"],
                            "column_index": config["column_index"],
                        }
                    )

                    response = requests.post(
                        f"{api_url}/connect", json=sys_info, timeout=5
                    )
                    if response.status_code != 200:
                        error("Không thể kết nối đến server!")
                        error(f"Lỗi: {response.text}")
                        print("Không thể kết nối đến server!")
                        print("Vui lòng nhập lại thông tin cấu hình")
                        dialog = SetupDialog()
                        new_config = dialog.get_result()
                        if not new_config:
                            warning("Hủy cài đặt.")
                            sys.exit(1)
                        config.update(new_config)
                        continue

                    print("Kết nối thành công!")
                    break

                except requests.exceptions.ConnectionError:
                    error(f"Không thể kết nối đến server tại {api_url}")
                    print("Vui lòng kiểm tra server đang chạy và IP đã đúng")
                    print("\nVui lòng nhập lại thông tin cấu hình")
                    dialog = SetupDialog()
                    new_config = dialog.get_result()
                    if not new_config:
                        warning("Hủy cài đặt.")
                        sys.exit(1)
                    config.update(new_config)
                    continue

                except Exception as e:
                    error(f"Lỗi kết nối: {str(e)}")
                    print("\nVui lòng nhập lại thông tin cấu hình")
                    dialog = SetupDialog()
                    new_config = dialog.get_result()
                    if not new_config:
                        warning("Hủy cài đặt.")
                        sys.exit(1)
                    config.update(new_config)
                    continue

            # Lưu cấu hình
            config_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl")
            if not os.path.exists(config_dir):
                os.makedirs(config_dir)
            config_path = os.path.join(config_dir, "agent_config.json")
            with open(config_path, "w") as f:
                json.dump(config, f)

            # Install Chocolatey
            info("Đang cài đặt Chocolatey...")
            success, message = choco_handle.install_chocolatey()
            if not success:
                error(f"Lỗi khi cài đặt Chocolatey: {message}")
                sys.exit(1)
            info(f"Chocolatey đã được cài đặt thành công: {message}")

            info("Đang giải nén agent...")
            self.extract_agent()

            info("Đang cài đặt agent...")
            if self.install_service():
                info("\nCài đặt thành công!")
                info(f"Agent đã được cài đặt tại: {self.install_dir}")
                info("Agent sẽ tự động chạy mỗi khi khởi động Windows")
                return True
            else:
                error("\nCài đặt thất bại!")
                sys.exit(1)

        except Exception as e:
            error(f"Lỗi trong quá trình cài đặt: {e}")
            sys.exit(1)


def main():
    # Đặt encoding cho console output
    sys.stdout = codecs.getwriter("utf-8")(sys.stdout.buffer)

    installer = AgentInstaller()
    installer.run()
    input("\nNhấn Enter để thoát...")


if __name__ == "__main__":
    main()
