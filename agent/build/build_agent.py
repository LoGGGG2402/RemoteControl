# agent/build/build_agent.py
import PyInstaller.__main__
import os
import sys

def build_agent():
    """Build agent thành một file .exe duy nhất"""
    try:
        # ... (phần lấy đường dẫn giữ nguyên) ...
        current_dir = os.path.dirname(os.path.abspath(__file__))
        agent_root = os.path.dirname(os.path.dirname(current_dir)) # Đi lên 2 cấp để đến gốc agent/
        sys.path.insert(0, agent_root) # Thêm vào đầu sys.path
        os.chdir(agent_root)
        print(f"Project Root: {agent_root}")
        print(f"Python Path: {sys.path}")

        main_script = os.path.join(agent_root, "agent", "main.py") # Sửa đường dẫn main.py
        icon_path = os.path.join(agent_root, "agent", "build", "icon.ico") # Sửa đường dẫn icon.ico
        print(f"Main script: {main_script}")
        print(f"Icon path: {icon_path}")

        if not os.path.exists(main_script):
             print(f"ERROR: Main script not found at {main_script}")
             return
        if not os.path.exists(icon_path):
             print(f"WARNING: Icon file not found at {icon_path}")
             icon_path = None # Bỏ icon nếu không tìm thấy


        PyInstaller.__main__.run([
            main_script,
            '--uac-admin',
            '--onefile',
            '--name=RemoteControlAgent', # Đổi tên output exe
            '--windowed', # Chạy ẩn không có console
            # '--noconsole', # Đồng nghĩa với --windowed
            f'--icon={icon_path}' if icon_path else None, # Chỉ thêm icon nếu tồn tại
            # Basic dependencies (có thể không cần nếu PyInstaller tự tìm được)
            '--hidden-import=websocket',
            '--hidden-import=requests',
            '--hidden-import=psutil',
            '--hidden-import=win32api',
            '--hidden-import=win32event',
            '--hidden-import=winerror',
            '--hidden-import=winreg', # Thêm winreg nếu dùng
            '--hidden-import=ctypes', # Thêm ctypes
            # System tray related imports
            '--hidden-import=pystray',
            '--hidden-import=PIL',
            # '--hidden-import=tkinter', # Thêm tkinter nếu ui.py hoặc messagebox dùng
            # Core module imports (Kiểm tra lại đường dẫn import trong code)
            '--hidden-import=agent.core.command_handler',
            '--hidden-import=agent.core.agent',
            '--hidden-import=agent.core.helper.system_info',
            '--hidden-import=agent.core.helper.choco_handle',
            '--hidden-import=agent.core.helper.file_handle',
            '--hidden-import=agent.core.utils.logger',
            '--hidden-import=agent.core.utils.ui',
            '--hidden-import=agent.core.utils.system_tray',
            '--hidden-import=agent.core.utils.startup_manager', 
             '--collect-all=pystray',
             '--collect-all=PIL',
        ])
        print("Build agent thành công!")
    except Exception as e:
        print(f"Lỗi khi build agent: {e}")
        raise e

if __name__ == "__main__":
    build_agent()