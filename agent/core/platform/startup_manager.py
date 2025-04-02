import sys
import os
import subprocess
import shutil
import uuid
import ctypes
import agent.core.utils.logger as logger

APP_GUID = "{bf70ebc0-5fcb-4c42-9761-1bb88e5d9fc7}"

if "PUT_YOUR_UNIQUE_GUID_HERE" in APP_GUID:
    logger.critical("CRITICAL: Default APP_GUID detected in startup_manager.py. Please generate a unique GUID!")
    APP_GUID = "{" + str(uuid.uuid4()) + "}"
    logger.warning(f"Auto-generated a temporary GUID: {APP_GUID} - This should be fixed in the source code!")

TASK_NAME = f"RemoteControlAgentStartup_{APP_GUID}"
INSTALL_DIR_NAME = "RemoteControlAgent"

def is_admin():
    try:
        is_admin_flag = ctypes.windll.shell32.IsUserAnAdmin() != 0
        logger.debug(f"Checking admin privileges: {is_admin_flag}")
        return is_admin_flag
    except AttributeError:
        logger.error("Failed to check admin status: shell32.IsUserAnAdmin not found.")
        return False
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return False

def get_program_files_path():
    prog_files = os.environ.get('ProgramW6432') or os.environ.get('ProgramFiles')
    if not prog_files:
         logger.warning("Could not reliably determine Program Files path, defaulting to C:\\Program Files")
         prog_files = 'C:\\Program Files'
    return prog_files

def get_install_path():
    program_files = get_program_files_path()
    path = os.path.join(program_files, INSTALL_DIR_NAME)
    logger.debug(f"Determined install path: {path}")
    return path

def get_executable_path():
    if getattr(sys, 'frozen', False):
        exe_path = sys.executable
        logger.debug(f"Running from frozen executable: {exe_path}")
        return exe_path
    else:
        exe_path = sys.executable
        script_path = os.path.abspath(sys.argv[0])
        logger.warning(f"Running from Python script ('{script_path}') using interpreter '{exe_path}'. Startup registration might target the interpreter, not the script directly.")
        return exe_path

def run_as_admin():
    if is_admin():
        logger.info("Already running as admin.")
        return True

    try:
        script_path = os.path.abspath(sys.argv[0])
        executable_to_run = sys.executable
        params = ' '.join([f'"{arg}"' for arg in sys.argv[1:]])

        if getattr(sys, 'frozen', False):
            params_for_runas = params
        else:
             params_for_runas = f'"{script_path}" {params}'

        logger.info(f"Attempting to relaunch with admin rights using 'runas':")
        logger.info(f"  Executable: {executable_to_run}")
        logger.info(f"  Parameters: {params_for_runas}")

        result = ctypes.windll.shell32.ShellExecuteW(
            None,
            "runas",
            executable_to_run,
            params_for_runas,
            None,
            1
        )

        if result > 32:
            logger.info("Admin rights successfully requested via ShellExecuteW. The current process should ideally exit if relaunch was intended.")
            return True
        else:
            error_code = result
            logger.error(f"Failed to request admin rights using ShellExecuteW (Error code: {error_code}). Possible reasons: User cancelled, security policy, file not found.")
            return False
    except Exception as e:
        logger.error(f"Exception while attempting to relaunch as admin: {e}")
        return False

def ensure_correct_location(allow_exit=True):
    try:
        if not getattr(sys, 'frozen', False):
            logger.info("Running from source code (.py), skipping location check.")
            return True, sys.executable

        current_path = os.path.normpath(sys.executable)
        install_path_dir = get_install_path()
        executable_name = os.path.basename(current_path)
        destination_path = os.path.normpath(os.path.join(install_path_dir, executable_name))

        logger.debug(f"Current executable location: {current_path}")
        logger.debug(f"Target installation location: {destination_path}")

        if current_path == destination_path:
            logger.info(f"Application is running from the correct installation path: {current_path}")
            return True, current_path

        logger.warning(f"Application is not running from the target location. Attempting to move.")

        if not is_admin():
            logger.warning("Admin rights required to move application to Program Files. Attempting elevation...")
            if run_as_admin():
                logger.info("Admin rights requested. Exiting current process to allow the elevated process to handle the move.")
                if allow_exit:
                    sys.exit(0)
                else:
                    return False, "Admin rights required but process exit not allowed after elevation request."
            else:
                return False, "Admin rights required to move application, but elevation failed or was denied."

        logger.info("Running with admin rights. Proceeding with moving the application...")
        try:
            if not os.path.exists(install_path_dir):
                logger.info(f"Creating installation directory: {install_path_dir}")
                os.makedirs(install_path_dir, exist_ok=True)

            if os.path.exists(destination_path):
                 logger.warning(f"Removing existing file at target destination: {destination_path}")
                 try:
                     os.remove(destination_path)
                 except OSError as remove_err:
                     logger.error(f"Failed to remove existing file at destination: {remove_err}. Aborting move.")
                     return False, f"Could not remove existing file: {remove_err}"

            logger.info(f"Copying '{current_path}' to '{destination_path}'")
            shutil.copy2(current_path, destination_path)
            logger.info("Copy successful.")

            logger.info(f"Relaunching application from new location: {destination_path}")
            subprocess.Popen([destination_path] + sys.argv[1:])

            if allow_exit:
                logger.info("Exiting current process after relaunching from new location.")
                sys.exit(0)
            else:
                logger.info("Relaunch initiated, but current process continues as allow_exit=False.")
                return True, destination_path

        except OSError as move_err:
            logger.error(f"OS error during file copy/move operation: {move_err}")
            return False, f"Error moving application file: {move_err}"
        except Exception as relaunch_err:
            logger.error(f"Error relaunching application from new location: {relaunch_err}")
            return False, f"Error relaunching application: {relaunch_err}"

    except Exception as e:
        logger.error(f"Unexpected error in ensure_correct_location: {e}")
        return False, f"Unexpected error checking location: {e}"

def register_startup_task(executable_path_to_register=None, task_name=TASK_NAME):
    if not is_admin():
        logger.warning("Admin rights required to register system-wide startup task.")
        return False, "Administrator rights required to register startup task."

    logger.info(f"Attempting to register startup task '{task_name}'...")
    try:
        if executable_path_to_register:
            exe_path = executable_path_to_register
            logger.info(f"Using provided executable path for registration: {exe_path}")
        else:
            location_ok, exe_path = ensure_correct_location(allow_exit=False)
            if not location_ok:
                 logger.error("Cannot register startup task: failed to ensure correct application location.")
                 return False, f"Failed to ensure correct location before registration: {exe_path}"
            logger.info(f"Using determined executable path for registration: {exe_path}")

        if not os.path.exists(exe_path):
             logger.error(f"Executable path for registration does not exist: '{exe_path}'")
             return False, f"Executable path not found: {exe_path}"
        if not exe_path.lower().endswith(".exe") and getattr(sys, 'frozen', False):
             logger.warning(f"Registering a non-'.exe' frozen application might be problematic: {exe_path}")

        command = [
            'schtasks', '/create', '/tn', task_name,
            '/tr', f'"{exe_path}"',
            '/sc', 'ONLOGON',
            '/rl', 'HIGHEST',
            '/f'
        ]
        logger.info(f"Executing Task Scheduler command: {' '.join(command)}")

        result = subprocess.run(command, capture_output=True, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW)

        if result.returncode == 0:
            logger.info(f"Successfully registered startup task '{task_name}'. Output: {result.stdout.strip()}")
            return True, f"Task '{task_name}' registered successfully."
        else:
            error_msg = f"Failed to register task (Code: {result.returncode}). Error: {result.stderr.strip()} Output: {result.stdout.strip()}"
            logger.error(error_msg)
            return False, f"Failed to register task: {result.stderr.strip()}"

    except FileNotFoundError:
        logger.error("Failed to register startup task: 'schtasks.exe' not found. Ensure it's in the system PATH.")
        return False, "'schtasks.exe' command not found."
    except Exception as e:
        logger.error(f"Unknown error during startup task registration: {e}")
        return False, f"An unknown error occurred during registration: {e}"

def unregister_startup_task(task_name=TASK_NAME):
    if not is_admin():
        logger.warning("Admin rights required to unregister system-wide startup task.")
        return False, "Administrator rights required to unregister startup task."

    logger.info(f"Attempting to unregister startup task '{task_name}'...")
    try:
        command = ['schtasks', '/delete', '/tn', task_name, '/f']
        logger.info(f"Executing Task Scheduler command: {' '.join(command)}")

        result = subprocess.run(command, capture_output=True, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW)

        if result.returncode == 0:
            logger.info(f"Successfully deleted startup task '{task_name}'. Output: {result.stdout.strip()}")
            return True, f"Task '{task_name}' deleted successfully."
        else:
            stderr_lower = result.stderr.lower()
            if "error: the system cannot find the file specified" in stderr_lower or \
               "error: the specified task name" in stderr_lower or \
               "không tìm thấy" in stderr_lower or \
               "does not exist" in stderr_lower:
                logger.info(f"Startup task '{task_name}' not found, considering it successfully unregistered.")
                return True, f"Task '{task_name}' was not found (already unregistered)."
            else:
                error_msg = f"Failed to delete task (Code: {result.returncode}). Error: {result.stderr.strip()} Output: {result.stdout.strip()}"
                logger.error(error_msg)
                return False, f"Failed to delete task: {result.stderr.strip()}"

    except FileNotFoundError:
        logger.error("Failed to unregister startup task: 'schtasks.exe' not found. Ensure it's in the system PATH.")
        return False, "'schtasks.exe' command not found."
    except Exception as e:
        logger.error(f"Unknown error during startup task unregistration: {e}")
        return False, f"An unknown error occurred during unregistration: {e}"

def check_startup_task_exists(task_name=TASK_NAME):
     logger.debug(f"Checking if startup task '{task_name}' exists...")
     try:
         command = ['schtasks', '/query', '/tn', task_name]
         result = subprocess.run(
             command, capture_output=True, text=True, check=False,
             creationflags=subprocess.CREATE_NO_WINDOW,
             encoding='utf-8', errors='ignore'
         )
         task_exists = result.returncode == 0
         logger.debug(f"Task '{task_name}' check result code: {result.returncode}. Exists: {task_exists}")
         return task_exists
     except FileNotFoundError:
         logger.error("Cannot check startup task: 'schtasks.exe' not found.")
         return False
     except Exception as e:
         logger.error(f"Error checking for startup task '{task_name}': {e}")
         return False