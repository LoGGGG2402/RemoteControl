import PyInstaller.__main__
import os
import sys

def build_agent():
    """Build agent thành một file .exe duy nhất"""
    try:
        # Get the current script directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up to the project root directory
        agent_root = os.path.dirname(current_dir)
        
        # Add the project root to sys.path to resolve imports
        sys.path.append(agent_root)
        
        # Change to the project root directory
        os.chdir(agent_root)
        
        print("Building agent.exe...")
        main_script = os.path.join(agent_root, "main.py")
        
        PyInstaller.__main__.run(
            [
                main_script,
                "--onefile",
                "--name=agent",
                "--icon=agent/build/icon.ico",
                "--hidden-import=websocket",
                "--hidden-import=requests",
                "--hidden-import=psutil",
                "--hidden-import=win32api",
                "--hidden-import=win32event",
                "--hidden-import=winerror",
                "--hidden-import=PyQt5",
                "--hidden-import=agent.core.command_handler",
                "--hidden-import=agent.core.helper.system_info",
                "--hidden-import=agent.core.helper.choco_handle",
                "--hidden-import=agent.core.helper.file_handle",
                "--hidden-import=agent.core.helper.logger",
                "--hidden-import=agent.core.ui",
                "--hidden-import=agent.core.agent",
            ]
        )
        print("Build agent thành công!")
    except Exception as e:
        print(f"Lỗi khi build agent: {e}")
        raise e

if __name__ == "__main__":
    build_agent()