import socket
import uuid
import psutil
import logging

logger = logging.getLogger(__name__)


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
            logger.error(f"Error getting process info: {e}")
            continue

    logger.info("Successfully retrieved process list")
    return process_list


def get_remote_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror):
        return None


def get_network_connections():
    connections = []
    for conn in psutil.net_connections(kind="inet"):
        if conn.laddr and conn.raddr:
            try:
                process = psutil.Process(conn.pid)
                remote_ip, remote_port = conn.raddr
                remote_host = get_remote_hostname(remote_ip)

                connections.append(
                    {
                        "pid": conn.pid,
                        "username": process.username(),
                        "name": process.name(),
                        # "local": f"{conn.laddr.ip}:{conn.laddr.port}",
                        "remote": f"{conn.raddr.ip}:{conn.raddr.port}",
                        "remote_host": remote_host,
                        "state": conn.status,
                    }
                )
            except Exception as e:
                print(f"Error getting process info: {e}")
                continue
    return connections


def get_system_info():
    hostname, ip_address, mac_address = get_basic_info()

    return {
        "ip_address": ip_address,
        "mac_address": mac_address,
        "hostname": hostname,
    }
