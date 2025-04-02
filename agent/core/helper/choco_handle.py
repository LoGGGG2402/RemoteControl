import subprocess
import os
from agent.core.utils.logger import info, error, warning # Assuming logger is setup

# Constants
CHOCO_INSTALL_ENV_VAR = "ChocolateyInstall"
DEFAULT_CHOCO_PATH = r"C:\ProgramData\chocolatey\bin\choco.exe"

def get_choco_path():
    """Determines the full path to the Chocolatey executable (choco.exe).

    Checks the %ChocolateyInstall% environment variable first, then falls back
    to the default installation path.

    Returns:
        str: The determined path to choco.exe.
    """
    choco_install_dir = os.getenv(CHOCO_INSTALL_ENV_VAR)
    if choco_install_dir and os.path.isdir(choco_install_dir):
        path = os.path.join(choco_install_dir, "bin", "choco.exe")
        info(f"Found Chocolatey path via environment variable: {path}")
        return path
    else:
        info(f"Chocolatey environment variable not found or invalid, using default path: {DEFAULT_CHOCO_PATH}")
        return DEFAULT_CHOCO_PATH

def is_chocolatey_installed():
    """Checks if Chocolatey appears to be installed by verifying the executable exists.

    Returns:
        bool: True if choco.exe exists at the determined path, False otherwise.
    """
    choco_path = get_choco_path()
    exists = os.path.exists(choco_path)
    info(f"Checking if Chocolatey exists at '{choco_path}': {exists}")
    return exists

def install_chocolatey():
    """Installs Chocolatey using the official PowerShell script if it's not already installed.

    Requires administrative privileges to run successfully.

    Returns:
        tuple[bool, str]: A tuple containing:
            - bool: True if installation was successful or already installed, False otherwise.
            - str: A message indicating the status or error.
    """
    info("Attempting to ensure Chocolatey is installed.")
    if is_chocolatey_installed():
        info("Chocolatey is already installed.")
        return True, "Chocolatey is already installed."

    info("Chocolatey not found, attempting installation...")
    try:
        # Command from the official Chocolatey installation guide
        powershell_command = (
            "Set-ExecutionPolicy Bypass -Scope Process -Force; "
            "[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; "
            "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
        )
        info(f"Running PowerShell command to install Chocolatey...")
        # Use CREATE_NO_WINDOW to hide the PowerShell window
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", powershell_command],
            capture_output=True,
            text=True,
            check=False, # Check manually below
            creationflags=subprocess.CREATE_NO_WINDOW
        )

        if result.returncode != 0:
            error(f"Chocolatey installation failed. PowerShell exit code: {result.returncode}")
            error(f"Stderr: {result.stderr}")
            error(f"Stdout: {result.stdout}")
            return False, f"Error installing Chocolatey: {result.stderr or result.stdout}"

        # Verify installation after running the script
        if is_chocolatey_installed():
            info("Chocolatey installed successfully.")
            return True, "Chocolatey installed successfully."
        else:
            error("Chocolatey installation script ran but choco.exe not found afterwards.")
            return False, "Chocolatey installation script finished, but verification failed."

    except FileNotFoundError:
         error("PowerShell command not found. Ensure PowerShell is in the system PATH.")
         return False, "PowerShell is required to install Chocolatey but was not found."
    except Exception as e:
        error(f"An unexpected error occurred during Chocolatey installation: {e}")
        return False, f"Unexpected error during installation: {e}"

def install_package(package_name, version=None):
    """Installs a package using Chocolatey.

    Args:
        package_name (str): The name of the package to install.
        version (str, optional): The specific version to install. Defaults to the latest.

    Returns:
        tuple[bool, str]: A tuple containing:
            - bool: True if installation was successful, False otherwise.
            - str: A message indicating the status or error details.
    """
    info(f"Attempting to install package: {package_name} (Version: {version or 'latest'})")
    if not is_chocolatey_installed():
        warning("Chocolatey is not installed. Cannot install package.")
        return False, "Chocolatey is not installed. Please install it first."

    choco_path = get_choco_path()
    command = [choco_path, "install", package_name, "-y", "-r"]
    if version:
        command.extend(["--version", version])

    info(f"Running Chocolatey command: {' '.join(command)}")
    try:
        # Use CREATE_NO_WINDOW to hide the console window
        result = subprocess.run(
            command, capture_output=True, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW
        )

        if result.returncode == 0:
            # Check stdout/stderr for potential warnings or non-fatal errors
            output = result.stdout + "\n" + result.stderr
            if "error" in output.lower() or "fail" in output.lower():
                 warning(f"Potential issue during installation of {package_name}: {output}")
                 # Consider it success for now, but log a warning
                 return True, f"Package {package_name} installed (with potential warnings)."
            info(f"Package {package_name} installed successfully.")
            return True, f"Package {package_name} installed successfully."
        else:
            error(f"Failed to install package {package_name}. Exit code: {result.returncode}")
            error(f"Stderr: {result.stderr}")
            error(f"Stdout: {result.stdout}")
            return False, f"Error installing package {package_name}: {result.stderr or result.stdout}"

    except Exception as e:
        error(f"An unexpected error occurred during package installation: {e}")
        return False, f"Unexpected error installing package {package_name}: {e}"

def uninstall_package(package_name):
    """Uninstalls a package using Chocolatey.

    Args:
        package_name (str): The name of the package to uninstall.

    Returns:
        tuple[bool, str]: A tuple containing:
            - bool: True if uninstallation was successful, False otherwise.
            - str: A message indicating the status or error details.
    """
    info(f"Attempting to uninstall package: {package_name}")
    if not is_chocolatey_installed():
        warning("Chocolatey is not installed. Cannot uninstall package.")
        return False, "Chocolatey is not installed."

    choco_path = get_choco_path()
    # -x: Force dependencies removal (use with caution)
    # -n: --limit-output for script parsing
    command = [choco_path, "uninstall", package_name, "-y", "-n"]
    info(f"Running Chocolatey command: {' '.join(command)}")
    try:
        # Use CREATE_NO_WINDOW
        result = subprocess.run(
            command, capture_output=True, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW
        )

        # Chocolatey uninstall might return 0 even if the package wasn't installed
        # or if there were non-fatal issues. Check output carefully.
        output = result.stdout + "\n" + result.stderr

        if f"{package_name} not installed" in output:
             warning(f"Package {package_name} was not installed, nothing to uninstall.")
             # Consider this a success in terms of the desired state
             return True, f"Package {package_name} was not installed."

        if result.returncode == 0:
            # Check for explicit failure messages despite exit code 0
            if "uninstall failed" in output.lower() or "error" in output.lower():
                warning(f"Potential error during uninstallation of {package_name} despite exit code 0: {output}")
                return False, f"Potential error during uninstallation: {output}"
            info(f"Package {package_name} uninstalled successfully.")
            return True, f"Package {package_name} uninstalled successfully."
        else:
            error(f"Failed to uninstall package {package_name}. Exit code: {result.returncode}")
            error(f"Stderr: {result.stderr}")
            error(f"Stdout: {result.stdout}")
            # Provide a more specific error if package not found vs other errors
            if "could not find package" in output.lower():
                 warning(f"Package {package_name} not found for uninstallation.")
                 return True, f"Package {package_name} not found."
            return False, f"Error uninstalling package {package_name}: {result.stderr or result.stdout}"

    except Exception as e:
        error(f"An unexpected error occurred during package uninstallation: {e}")
        return False, f"Unexpected error uninstalling package {package_name}: {e}"

def list_installed_packages():
    """Lists locally installed packages using Chocolatey.

    Filters out the core Chocolatey packages.

    Returns:
        tuple[bool, list[str] | str]: A tuple containing:
            - bool: True if the list was retrieved successfully, False otherwise.
            - list[str] | str: A list of installed package names (e.g., ['package1 1.0', 'package2 2.1'])
                              or an error message string.
    """
    info("Attempting to list installed Chocolatey packages.")
    if not is_chocolatey_installed():
        warning("Chocolatey is not installed. Cannot list packages.")
        return False, "Chocolatey is not installed."

    choco_path = get_choco_path()
    command = [choco_path, "list", "--local-only", "-r"] # -r for parsable output
    info(f"Running Chocolatey command: {' '.join(command)}")
    try:
        # Use CREATE_NO_WINDOW
        result = subprocess.run(
            command, capture_output=True, text=True, check=False, creationflags=subprocess.CREATE_NO_WINDOW
        )

        if result.returncode == 0:
            packages = []
            lines = result.stdout.strip().split("\n")
            info(f"Successfully listed packages. Found {len(lines)} lines.")
            for line in lines:
                if not line:
                    continue
                # Expected format: package|version
                parts = line.strip().split('|')
                if len(parts) == 2:
                    package_name = parts[0]
                    version = parts[1]
                    # Filter out core choco packages if needed (optional)
                    # if not package_name.startswith(('chocolatey', 'choco-')): 
                    packages.append(f"{package_name} {version}") # Combine name and version
                else:
                     warning(f"Unexpected format in choco list output line: '{line}'")
            return True, packages
        else:
            error(f"Failed to list packages. Exit code: {result.returncode}")
            error(f"Stderr: {result.stderr}")
            error(f"Stdout: {result.stdout}")
            return False, f"Error listing packages: {result.stderr or result.stdout}"

    except Exception as e:
        error(f"An unexpected error occurred while listing packages: {e}")
        return False, f"Unexpected error listing packages: {e}"