# Standard library imports
import platform
import socket
import datetime
import uuid
import time
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError

# Third-party library imports
import psutil

# Local imports
from agent.core.utils.logger import info, error, warning


def get_basic_info():
    hostname = socket.gethostname()
    ip_address = socket.gethostbyname(hostname)
    mac_address = ":".join(
        [
            "{:02x}".format((uuid.getnode() >> elements) & 0xFF)
            for elements in range(0, 8 * 6, 8)
        ][::-1]
    )
    return hostname, ip_address, mac_address


def get_process_list():
    process_list = []
    for proc in psutil.process_iter():
        try:
            pinfo = proc.as_dict(
                attrs=[
                    "name",
                    "pid",
                    "status",
                    "cpu_percent",
                    "create_time",
                    "username",
                ]
            )
            pinfo["cpu_percent"] = proc.cpu_percent(interval=0.01)
            pinfo["memory_mb"] = proc.memory_info().rss / (1024 * 1024)  # Convert to MB
            process_list.append(pinfo)
        except Exception as e:
            error(f"Error getting process info: {e}")
            continue

    info("Successfully retrieved process list")
    return process_list


def get_remote_hostname(ip, timeout=0.5):
    """
    Get hostname with a timeout to avoid hanging
    """
    try:
        socket.setdefaulttimeout(timeout)
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror, socket.timeout):
        return None
    except Exception as e:
        error(f"Error resolving hostname for {ip}: {str(e)}")
        return None


def get_network_connections():
    """
    Get network connections with improved error handling and performance
    """
    start_time = time.time()
    connections = []
    connection_count = 0
    error_count = 0
    
    try:
        # Limit the total execution time
        max_execution_time = 15  # seconds
        
        # Get all connections first
        all_connections = psutil.net_connections(kind="inet")
        connection_count = len(all_connections)
        info(f"Found {connection_count} total network connections")
        
        # Filter connections with remote addresses
        filtered_connections = [conn for conn in all_connections if conn.laddr and conn.raddr]
        
        # Process connections with a limit on total time
        for conn in filtered_connections:
            # Check if we've exceeded our time budget
            if time.time() - start_time > max_execution_time:
                warning(f"Network connection processing timeout after {max_execution_time} seconds")
                break
                
            try:
                process = psutil.Process(conn.pid)
                remote_ip, remote_port = conn.raddr
                
                # Skip hostname resolution for private IPs to save time
                if remote_ip.startswith(('10.', '172.', '192.168.')):
                    remote_host = None
                else:
                    remote_host = get_remote_hostname(remote_ip)
                
                connections.append(
                    {
                        "pid": conn.pid,
                        "username": process.username(),
                        "name": process.name(),
                        "remote": f"{remote_ip}:{remote_port}",
                        "remote_host": remote_host,
                        "state": conn.status,
                    }
                )
            except psutil.NoSuchProcess:
                # Process might have terminated
                continue
            except psutil.AccessDenied:
                # No permission to access this process
                continue
            except Exception as e:
                error_count += 1
                error(f"Error processing network connection: {str(e)}")
                continue

        elapsed_time = time.time() - start_time
        info(f"Network connections processed in {elapsed_time:.2f} seconds. "
             f"Retrieved {len(connections)} of {connection_count} connections. "
             f"Errors: {error_count}")
        
        # Sort connections by process name for better readability
        connections.sort(key=lambda x: x.get("name", ""))
        
    except Exception as e:
        error(f"Critical error in get_network_connections: {str(e)}")
        
    return connections


def get_system_info():
    hostname, ip_address, mac_address = get_basic_info()

    return {
        "ip_address": ip_address,
        "mac_address": mac_address,
        "hostname": hostname,
    }
