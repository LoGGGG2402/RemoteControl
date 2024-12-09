import socket
import uuid
import psutil


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
            # pinfo['create_time'] = datetime.fromtimestamp(pinfo['create_time']).strftime('%Y-%m-%d %H:%M:%S')
            process_list.append(pinfo)
        except Exception as e:
            print(f"Error getting process info: {e}")
            continue

    print("success")
    return process_list


def get_remote_hostname(ip):
    try:
        return socket.gethostbyaddr(ip)[0]
    except (socket.herror, socket.gaierror):
        return None


def extract_url_from_connection(remote_ip, port):
    if port == 80:
        return f"http://{remote_ip}"
    elif port == 443:
        return f"https://{remote_ip}"
    return None


def get_network_connections():
    connections = []
    for conn in psutil.net_connections(kind="inet"):
        if conn.laddr and conn.raddr:
            try:
                process = psutil.Process(conn.pid)
                remote_ip, remote_port = conn.raddr
                remote_host = get_remote_hostname(remote_ip)
                # remote_url = extract_url_from_connection(remote_ip, remote_port)

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


def get_system_info(room_id, row_index, column_index):
    hostname, ip_address, mac_address = get_basic_info()

    return {
        "room_id": room_id,
        "row_index": row_index,
        "column_index": column_index,
        "ip_address": ip_address,
        "mac_address": mac_address,
        "hostname": hostname,
    }


# Testing the functions
from tabulate import tabulate
from datetime import datetime

def format_system_info(info):
    return "\n".join([f"{k.upper():15} : {v}" for k, v in info.items()])


def format_process_list(processes):
    return tabulate(
        [
            (
                p["name"],
                p["pid"],
                p.get(
                    "username", "N/A"
                ),  # Use get() with default value in case username is not available
                p["status"],
                f"{p['cpu_percent']:.1f}%",
                f"{p['memory_mb']:.1f}MB",
                datetime.fromtimestamp(p["create_time"]).strftime("%Y-%m-%d %H:%M:%S"),
            )
            for p in processes
        ],
        headers=["Process Name", "PID", "User", "Status", "CPU %", "Memory", "Created"],
        tablefmt="grid",
    )


def format_network_connections(connections):
    return tabulate(
        [
            (
                c["name"],
                c["pid"],
                c["username"],
                # c["local"],
                c["remote"],
                c.get("remote_host", "N/A"),
                # c.get("remote_url", "N/A"),
                c["state"],
            )
            for c in connections
        ],
        headers=[
            "Process Name",
            "PID",
            "User",
            # "Local Address",
            "Remote Address",
            "Remote Host",
            # "URL",
            "State",
        ],
        tablefmt="grid",
    )


if __name__ == "__main__":
    print("\n=== System Information ===")
    print(format_system_info(get_system_info(1, 1, 1)))

    print("\n=== Process List ===")
    print(format_process_list(get_process_list()))

    print("\n=== Network Connections ===")
    print(format_network_connections(get_network_connections()))
