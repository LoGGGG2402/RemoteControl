import os
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Local imports
from agent.core.utils.logger import info, error, warning

# Configure retry strategy for requests
retry_strategy = Retry(
    total=3,                 # Maximum number of retries
    backoff_factor=1,        # Delay between retries (factor * {0, 1, 2, ...} seconds)
    status_forcelist=[500, 502, 503, 504], # HTTP status codes to retry on
)

# Create a requests session with the retry strategy mounted
session = requests.Session()
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("http://", adapter)
session.mount("https://", adapter)

# Define the base directory for managed file downloads within ProgramData
# Using ProgramData is generally preferred for application data shared across users
BASE_DOWNLOAD_DIR = os.path.join(os.getenv('PROGRAMDATA', 'C:\\ProgramData'), 'RemoteControlAgent', 'ManagedFiles')

def _ensure_dir_exists(directory_path):
    """Ensures that the specified directory exists, creating it if necessary.

    Args:
        directory_path (str): The path to the directory.

    Raises:
        OSError: If the directory cannot be created (e.g., due to permissions).
    """
    if not os.path.exists(directory_path):
        info(f"Directory not found, creating: {directory_path}")
        try:
            os.makedirs(directory_path, exist_ok=True)
            info(f"Successfully created directory: {directory_path}")
        except OSError as e:
            error(f"Failed to create directory '{directory_path}': {e}")
            raise # Re-raise to indicate failure to the calling function
    # else: Directory already exists, no action needed

def install_file(server_link, file_name, file_link):
    """Downloads a file from the server and saves it to the managed files directory.

    Args:
        server_link (str): The base URL of the server (e.g., "http://server.com").
        file_name (str): The desired name for the file locally.
        file_link (str): The relative path or URL segment of the file on the server (e.g., "/downloads/file.zip").

    Returns:
        tuple[bool, str]: A tuple containing:
            - bool: True if the file was downloaded and saved successfully, False otherwise.
            - str: A message indicating success or the reason for failure.
    """
    if not file_name or not file_link:
        warning("Install file called with empty file_name or file_link.")
        return False, "File name and link are required."

    try:
        _ensure_dir_exists(BASE_DOWNLOAD_DIR) # Ensure base directory exists first

        # Construct the full download URL
        # Handle potential double slashes if server_link ends with / and file_link starts with /
        full_url = f"{server_link.rstrip('/')}/{file_link.lstrip('/')}"

        # Sanitize file_name to prevent directory traversal vulnerabilities
        # os.path.basename extracts the filename part from any path-like string
        safe_file_name = os.path.basename(file_name)
        if not safe_file_name:
            warning(f"Provided file_name '{file_name}' resulted in an empty safe name.")
            return False, "Invalid file name provided (potentially unsafe characters)."

        destination_path = os.path.join(BASE_DOWNLOAD_DIR, safe_file_name)

        info(f"Attempting to download '{safe_file_name}' from '{full_url}' to '{destination_path}'")

        # Use the pre-configured session with retries and timeout
        # connect timeout: time to establish connection
        # read timeout: time to wait for first byte after connection
        response = session.get(full_url, timeout=(5, 30), stream=True) # Use stream=True for potentially large files
        response.raise_for_status() # Raises HTTPError for bad responses (4xx or 5xx)

        # Download and save the file chunk by chunk
        with open(destination_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192): # Download in 8KB chunks
                f.write(chunk)

        info(f"Successfully downloaded and saved '{safe_file_name}'.")
        return True, f"File '{safe_file_name}' installed successfully."

    except requests.exceptions.HTTPError as e:
        error(f"HTTP error downloading '{safe_file_name}' from '{full_url}': {e}")
        return False, f"Failed to download file: HTTP {e.response.status_code} {e.response.reason}"
    except requests.exceptions.ConnectionError as e:
        error(f"Connection error downloading '{safe_file_name}' from '{full_url}': {e}")
        return False, f"Connection error: Could not connect to the server."
    except requests.exceptions.Timeout as e:
        error(f"Timeout downloading '{safe_file_name}' from '{full_url}': {e}")
        return False, "Download timed out."
    except requests.exceptions.RequestException as e:
        error(f"General request error downloading '{safe_file_name}' from '{full_url}': {e}")
        return False, f"Failed to download file: {e}"
    except OSError as e:
        error(f"OS error saving file '{destination_path}' (check permissions?): {e}")
        return False, f"Failed to save file due to OS error: {e}"
    except Exception as e:
        error(f"Unexpected error installing file '{safe_file_name}': {e}")
        return False, f"An unexpected error occurred during file installation: {e}"

def remove_file(file_name):
    """Removes a file from the managed files directory.

    Args:
        file_name (str): The name of the file to remove.

    Returns:
        tuple[bool, str]: A tuple containing:
            - bool: True if the file was removed successfully or didn't exist, False otherwise.
            - str: A message indicating success, file not found, or the reason for failure.
    """
    if not file_name:
        warning("Remove file called with empty file_name.")
        return False, "File name is required."

    try:
        # Sanitize file_name again for safety
        safe_file_name = os.path.basename(file_name)
        if not safe_file_name:
            warning(f"Provided file_name '{file_name}' resulted in an empty safe name for removal.")
            return False, "Invalid file name provided (potentially unsafe characters)."

        file_path = os.path.join(BASE_DOWNLOAD_DIR, safe_file_name)

        if os.path.exists(file_path):
            if os.path.isfile(file_path): # Ensure it's a file, not a directory
                info(f"Attempting to remove file: {file_path}")
                os.remove(file_path)
                # Verify removal
                if not os.path.exists(file_path):
                    info(f"Successfully removed file '{safe_file_name}'.")
                    return True, f"File '{safe_file_name}' removed successfully."
                else:
                    # This case might happen due to permissions or locks
                    error(f"Attempted to remove file '{file_path}', but it still exists.")
                    return False, "Failed to remove file (it still exists after attempt)."
            else:
                warning(f"Path exists but is not a file, cannot remove: {file_path}")
                return False, f"Path '{safe_file_name}' exists but is not a file."
        else:
            info(f"File not found for removal, considered successful: {file_path}")
            # If the goal is absence, not finding it is also a success state
            return True, "File not found."

    except OSError as e:
        error(f"OS error removing file '{file_path}' (check permissions?): {e}")
        return False, f"Failed to remove file due to OS error: {e}"
    except Exception as e:
        error(f"Unexpected error removing file '{safe_file_name}': {e}")
        return False, f"An unexpected error occurred during file removal: {e}"

def get_files():
    """Lists the names of all files present in the managed files directory.

    Returns:
        list[str]: A list of file names found in the directory. Returns an empty list
                   if the directory doesn't exist or an error occurs.
    """
    if not os.path.exists(BASE_DOWNLOAD_DIR):
        info(f"Managed files directory does not exist: {BASE_DOWNLOAD_DIR}")
        return [] # Directory not found, return empty list
    if not os.path.isdir(BASE_DOWNLOAD_DIR):
        error(f"Expected directory but found file at path: {BASE_DOWNLOAD_DIR}")
        return [] # Path exists but is not a directory

    files = []
    try:
        info(f"Listing files in directory: {BASE_DOWNLOAD_DIR}")
        # Use os.scandir for potentially better performance on many files
        for entry in os.scandir(BASE_DOWNLOAD_DIR):
            if entry.is_file():
                files.append(entry.name)
        info(f"Found {len(files)} files.")
        return files
    except OSError as e:
        error(f"OS error listing files in '{BASE_DOWNLOAD_DIR}': {e}")
        return [] # Return empty list on error
    except Exception as e:
        error(f"Unexpected error listing files in '{BASE_DOWNLOAD_DIR}': {e}")
        return []
