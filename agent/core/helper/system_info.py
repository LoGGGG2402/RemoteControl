# Standard library imports
import socket
import uuid
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError

# Third-party library imports
import psutil

# Local imports
from agent.core.utils.logger import info, error, warning

# Constants
NETWORK_CONN_TIMEOUT = 15 # Maximum seconds allowed for network connection retrieval
REMOTE_HOSTNAME_TIMEOUT = 0.3 # Timeout for individual remote hostname DNS lookups
PROCESS_CPU_INTERVAL = 0.01 # Interval for cpu_percent calculation

def get_basic_info():
    """Retrieves basic system identification information.

    Returns:
        tuple[str, str, str]: A tuple containing:
            - hostname (str): The system's hostname.
            - ip_address (str): The primary IPv4 address associated with the hostname.
            - mac_address (str): The MAC address of the primary network interface.
    """
    try:
        hostname = socket.gethostname()
        # Resolve hostname to get the primary IP, handle potential errors
        try:
            ip_address = socket.gethostbyname(hostname)
        except socket.gaierror:
            warning(f"Could not resolve hostname '{hostname}' to an IP address.")
            ip_address = "Unknown"

        # Get MAC address
        mac_int = uuid.getnode()
        if (mac_int >> 40) % 2:
             # Locally administered MAC, may not be useful
             warning("MAC address appears to be locally administered.")
             mac_address = "Locally Administered"
        else:
            mac_address = ":".join(f"{(mac_int >> elements) & 0xFF:02x}" for elements in range(0, 8 * 6, 8))[::-1]

        info(f"Basic info retrieved: Host={hostname}, IP={ip_address}, MAC={mac_address}")
        return hostname, ip_address, mac_address

    except Exception as e:
        error(f"Failed to get basic system info: {e}")
        return "Unknown", "Unknown", "Unknown"

def get_process_list():
    """Retrieves a list of running processes and their basic information.

    Returns:
        list[dict]: A list of dictionaries, each representing a process.
                    Returns an empty list if errors occur during iteration.
    """
    process_list = []
    info("Retrieving process list...")
    try:
        for proc in psutil.process_iter(['pid', 'name', 'status', 'username', 'create_time']):
            try:
                pinfo = proc.info
                # Get CPU percent with a short interval
                pinfo["cpu_percent"] = proc.cpu_percent(interval=PROCESS_CPU_INTERVAL)
                # Get memory usage in MB
                pinfo["memory_mb"] = proc.memory_info().rss / (1024 * 1024)
                # Convert create_time (timestamp) to human-readable format (optional)
                # pinfo["create_time_str"] = datetime.datetime.fromtimestamp(pinfo['create_time']).strftime("%Y-%m-%d %H:%M:%S")
                process_list.append(pinfo)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                # Process might have terminated or access denied between iterations
                continue
            except Exception as e:
                # Log specific process error but continue iteration
                warning(f"Error getting info for process PID {proc.pid if proc else 'N/A'}: {e}")
                continue

        info(f"Successfully retrieved information for {len(process_list)} processes.")
        return process_list
    except Exception as e:
        error(f"Failed to iterate through processes: {e}")
        return [] # Return empty list on major iteration error

def get_remote_hostname(ip):
    """Performs a reverse DNS lookup for an IP address with a timeout.

    Args:
        ip (str): The IP address to look up.

    Returns:
        str or None: The resolved hostname, or None if lookup fails or times out.
    """
    try:
        # socket.gethostbyaddr can block, run it in a thread with timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(socket.gethostbyaddr, ip)
            try:
                # Wait for the result with a specific timeout
                hostname, _, _ = future.result(timeout=REMOTE_HOSTNAME_TIMEOUT)
                return hostname
            except TimeoutError:
                # info(f"Timeout resolving hostname for {ip}") # Optional: log timeouts
                return None
            except (socket.herror, socket.gaierror) as dns_error:
                # info(f"DNS lookup failed for {ip}: {dns_error}") # Optional: log DNS errors
                return None
    except Exception as e:
        warning(f"Unexpected error resolving hostname for {ip}: {e}")
        return None

def get_network_connections():
    """Retrieves active network connections (TCP/UDP) with associated process info.

    Attempts to resolve remote hostnames for non-private IPs with a timeout.
    Implements an overall timeout to prevent excessive runtime.

    Returns:
        list[dict]: A list of dictionaries, each representing a connection.
    """
    info("Retrieving network connections...")
    start_time = time.time()
    connections_data = []
    connection_count = 0
    processed_count = 0
    error_count = 0

    try:
        # Get all internet connections (TCP & UDP)
        all_connections = psutil.net_connections(kind="inet")
        connection_count = len(all_connections)
        info(f"Found {connection_count} total network connections.")

        # Use a ThreadPoolExecutor for potentially faster hostname lookups
        # Adjust max_workers based on testing and expected load
        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_conn = {}

            # Iterate through connections and prepare data, submit hostname lookups
            for conn in all_connections:
                 # Check for overall timeout
                if time.time() - start_time > NETWORK_CONN_TIMEOUT:
                    warning(f"Network connection processing timed out after {NETWORK_CONN_TIMEOUT} seconds.")
                    break # Stop processing further connections

                # Skip connections without a PID or in specific states if desired (e.g., LISTEN)
                if not conn.pid or conn.status == psutil.CONN_LISTEN:
                     continue

                try:
                    proc = psutil.Process(conn.pid)
                    proc_name = proc.name()
                    proc_user = proc.username()

                    conn_info = {
                        "pid": conn.pid,
                        "username": proc_user,
                        "name": proc_name,
                        "local_addr": f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                        "remote_addr": f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                        "status": conn.status,
                        "type": conn.type, # SOCK_STREAM (TCP) or SOCK_DGRAM (UDP)
                        "remote_host": None # Placeholder
                    }

                    # Only attempt hostname lookup for established TCP connections with a remote address
                    if conn.raddr and conn.status == psutil.CONN_ESTABLISHED and conn.type == socket.SOCK_STREAM:
                        remote_ip = conn.raddr.ip
                        # Basic check for private/local IPs to avoid unnecessary lookups
                        if not (remote_ip.startswith(('10.', '172.', '192.168.', '127.')) or remote_ip == '::1'):
                            future = executor.submit(get_remote_hostname, remote_ip)
                            future_to_conn[future] = conn_info # Map future back to its connection info
                        # else: Private/local IP, skip lookup

                    connections_data.append(conn_info)
                    processed_count += 1

                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    # Process ended or access denied, skip this connection
                    continue
                except Exception as e:
                    error_count += 1
                    warning(f"Error processing connection for PID {conn.pid}: {e}")
                    continue

            # Process completed hostname lookups
            info(f"Waiting for {len(future_to_conn)} remote hostname lookups...")
            for future in as_completed(future_to_conn): # Process as they complete
                 if time.time() - start_time > NETWORK_CONN_TIMEOUT:
                     warning("Timeout reached while waiting for hostname lookups.")
                     # Optionally cancel remaining futures: future.cancel()
                     break
                 conn_info_ref = future_to_conn[future]
                 try:
                     hostname = future.result(timeout=0.1) # Small timeout here as bulk are waited on
                     if hostname:
                         conn_info_ref["remote_host"] = hostname
                 except TimeoutError:
                     pass # Timeout handled within get_remote_hostname or here
                 except Exception as e:
                     warning(f"Error retrieving result from hostname lookup future: {e}")

    except Exception as e:
        error(f"Critical error during network connection retrieval: {e}")
        # Return whatever was collected so far, or an empty list
        return connections_data

    finally:
        elapsed_time = time.time() - start_time
        info(f"Network connections processing finished in {elapsed_time:.2f}s. Processed: {processed_count}/{connection_count}. Errors: {error_count}.")
        # Sort results for consistency
        connections_data.sort(key=lambda x: (x.get("name", ""), x.get("pid", 0)))

    return connections_data

def get_system_info():
    """Gathers various system information points.

    Returns:
        dict: A dictionary containing system information like IP, MAC, hostname.
    """
    info("Gathering system information...")
    hostname, ip_address, mac_address = get_basic_info()
    # Add more system info points here as needed
    # e.g., os_version = platform.platform()
    #       cpu_info = platform.processor()
    #       memory_info = psutil.virtual_memory()

    system_data = {
        "ip_address": ip_address,
        "mac_address": mac_address,
        "hostname": hostname,
        # "os_version": os_version,
        # "cpu_info": cpu_info,
        # "total_memory_gb": memory_info.total / (1024**3),
        # "available_memory_gb": memory_info.available / (1024**3),
    }
    info("System information gathered.")
    return system_data
