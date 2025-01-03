import os
import base64
import PyInstaller.__main__


def encode_agent():
    """Mã hóa agent thành base64"""
    try:
        print("Mã hóa agent...")
        with open("dist/agent.exe", "rb") as f:
            binary_data = f.read()
        encoded_bytes = base64.b64encode(binary_data)
        encoded_string = encoded_bytes.decode("utf-8")
        print("Mã hóa thành công!")
        return encoded_string
    except Exception as e:
        print(f"Lỗi khi mã hóa agent: {e}")
        raise e


def build_installer():
    """Build installer thành một file .exe duy nhất"""
    try:
        # Đầu tiên build agent
        print("Building agent.exe...")
        PyInstaller.__main__.run(
            [
                "agent.py",
                "--onefile",
                "--name=agent",
                "--icon=icon.ico",
                "--hidden-import=websocket",
                "--hidden-import=requests",
                "--hidden-import=psutil",
                "--hidden-import=tabulate",
                "--hidden-import=pywin32",
            ]
        )

        # Mã hóa agent.exe
        print("\nMã hóa agent.exe...")
        encoded_agent = encode_agent()

        # Đọc template installer
        with open("agent_installer.py", "r", encoding="utf-8") as f:
            installer_code = f.read()

        # Thay thế biến ENCODED_AGENT_DATA bằng dữ liệu đã mã hóa
        installer_code = installer_code.replace(
            "ENCODED_AGENT_DATA = None", f'ENCODED_AGENT_DATA = """{encoded_agent}"""'
        )

        # Ghi ra file tạm
        with open("temp_installer.py", "w", encoding="utf-8") as f:
            f.write(installer_code)

        # Build installer
        print("\nBuilding installer.exe...")
        PyInstaller.__main__.run(
            [
                "temp_installer.py",
                "--onefile",
                "--name=install_agent",
                "--icon=icon.ico",
                "--hidden-import=win32serviceutil",
                "--hidden-import=win32service",
                "--hidden-import=win32event",
                "--hidden-import=win32api",
                "--hidden-import=win32security",
            ]
        )

        # Dọn dẹp
        os.remove("temp_installer.py")
        print("\nBuild thành công!")
        print("File cài đặt: dist/install_agent.exe")

    except Exception as e:
        print(f"Lỗi khi build installer: {str(e)}")
        raise e


if __name__ == "__main__":
    build_installer()
