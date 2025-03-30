import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Thêm cấu hình retry strategy
retry_strategy = Retry(
    total=3,  # số lần thử lại tối đa
    backoff_factor=1,  # thời gian chờ giữa các lần thử
    status_forcelist=[500, 502, 503, 504],  # các mã lỗi cần retry
)
session = requests.Session()
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)


def install_file(server_link, file_name, file_link):
    """
    Cài đặt file từ server vào máy tính
    """
    try:
        link = f"{server_link}{file_link}"
        destination = f"C:/Downloads/RemoteControl/{file_name}"

        if not os.path.exists("C:/Downloads/RemoteControl"):
            os.makedirs("C:/Downloads/RemoteControl")

        # Sử dụng session với timeout
        response = session.get(link, timeout=(5, 30))  # (connect timeout, read timeout)
        if response.status_code == 200:
            with open(destination, "wb") as f:
                f.write(response.content)
            return True, "File installed successfully"
        else:
            return False, f"Failed to download file: HTTP {response.status_code}"
    except requests.exceptions.ConnectionError as e:
        return False, f"Connection error: {str(e)}"
    except requests.exceptions.Timeout as e:
        return False, f"Request timed out: {str(e)}"
    except Exception as e:
        return False, f"Failed to install file: {str(e)}"


def remove_file(file_name):
    """
    Xóa file từ máy tính
    """
    try:
        file_path = f"C:/Downloads/RemoteControl/{file_name}"

        if os.path.exists(file_path):
            os.remove(file_path)
            return True, "File removed successfully"
        else:
            return False, "File not found"
    except Exception as e:
        return False, f"Failed to remove file: {str(e)}"


def get_files():
    if not os.path.exists("C:/Downloads/RemoteControl"):
        return []
    files = []
    for item in os.listdir("C:/Downloads/RemoteControl"):
        if os.path.isfile(os.path.join("C:/Downloads/RemoteControl", item)):
            files.append(item)
    return files
