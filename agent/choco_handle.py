import subprocess
import os


def get_choco_path():
    """Get the full path to choco.exe"""
    return (
        os.path.expandvars(r"%ChocolateyInstall%\bin\choco.exe")
        if "ChocolateyInstall" in os.environ
        else r"C:\ProgramData\chocolatey\bin\choco.exe"
    )


def install_chocolatey():
    """Install Chocolatey package manager if not already installed"""
    try:
        choco_path = get_choco_path()
        # Check if Chocolatey is already installed
        if os.path.exists(choco_path):
            result = subprocess.run(
                [choco_path, "--version"], capture_output=True, text=True
            )
            if result.returncode == 0:
                return True, "Chocolatey is already installed"

        # Install Chocolatey using PowerShell
        powershell_command = """Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"""
        subprocess.run(["powershell", "-Command", powershell_command], check=True)
        return True, "Chocolatey installed successfully"
    except subprocess.CalledProcessError as e:
        return False, f"Error installing Chocolatey: {str(e)}"
    except Exception as e:
        return False, f"Unexpected error: {str(e)}"


def install_package(package_name, version=None):
    """Install a package using Chocolatey"""
    try:
        choco_path = get_choco_path()
        if not os.path.exists(choco_path):
            return False, "Chocolatey is not installed. Please install it first."
        if version:
            result = subprocess.run(
                [choco_path, "install", package_name, "--version", version, "-y"],
                capture_output=True,
                text=True,
            )
        else:
            result = subprocess.run(
                [choco_path, "install", package_name, "-y"],
                capture_output=True,
                text=True,
            )
        if result.returncode == 0:
            return True, f"Package {package_name} installed successfully"
        return False, f"Error installing package: {result.stderr}"
    except subprocess.CalledProcessError as e:
        return False, f"Error: {str(e)}"


def uninstall_package(package_name):
    """Uninstall a package using Chocolatey"""
    try:
        choco_path = get_choco_path()
        if not os.path.exists(choco_path):
            return False, "Chocolatey is not installed. Please install it first."
        result = subprocess.run(
            [choco_path, "uninstall", package_name, "-y", "-x", "-r"],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            success, list_package = list_installed_packages()
            if success and package_name in list_package:
                return False, f"Error uninstalling package: {result.stderr}"
            return True, f"Package {package_name} uninstalled successfully"
        return False, f"Error uninstalling package: {result.stderr}"
    except subprocess.CalledProcessError as e:
        return False, f"Error: {str(e)}"


def list_installed_packages():
    """List all packages installed by Chocolatey"""
    try:
        choco_path = get_choco_path()
        if not os.path.exists(choco_path):
            return False, "Chocolatey is not installed. Please install it first."
        result = subprocess.run([choco_path, "list"], capture_output=True, text=True)
        if result.returncode == 0:
            # Parse the output to get package names and versions
            packages = []
            for line in result.stdout.split("\n")[1:]:
                if "packages installed." in line:
                    break
                if " " in line:  # Package lines contain '|'
                    package_info = line.split(" ")[0].strip()
                    if package_info and not package_info.startswith("chocolatey"):
                        packages.append(package_info)
            return True, packages
        return False, f"Error listing packages: {result.stdout}"
    except subprocess.CalledProcessError as e:
        return False, f"Error: {str(e)}"


# Test the functions
if __name__ == "__main__":
    success, message = install_chocolatey()
    print(f"Success: {success}, Message: {message}")

    success, packages = list_installed_packages()
    print(f"Success: {success}, Packages: {packages}")

    success, message = install_package("notepadplusplus")
    print(f"Success: {success}, Message: {message}")

    success, packages = list_installed_packages()
    print(f"Success: {success}, Packages: {packages}")

    success, message = uninstall_package("notepadplusplus")
    print(f"Success: {success}, Message: {message}")

    success, packages = list_installed_packages()
    print(f"Success: {success}, Packages: {packages}")
