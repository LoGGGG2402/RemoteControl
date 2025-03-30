import os
import sys
import shutil
import subprocess
import agent.core.helper.choco_handle as choco_handle
import agent.core.utils.logger as logger


def move_executable(service_destination_path):
    """
    Di chuyển file thực thi của agent đến vị trí thích hợp
    
    Args:
        service_destination_path (str): Đường dẫn thư mục đích để lưu file thực thi
        
    Returns:
        tuple: (bool, str) - (Thành công/thất bại, đường dẫn đích hoặc thông báo lỗi)
    """
    try:
        # Chỉ thực hiện nếu đang chạy dưới dạng file thực thi đã được đóng gói
        if not getattr(sys, 'frozen', False):
            logger.info("Không phải là file thực thi đã được đóng gói, bỏ qua bước di chuyển")
            return True, "Bỏ qua di chuyển file thực thi (không phải file đóng gói)"
        
        # Tạo thư mục đích nếu chưa tồn tại
        executable_path = sys.executable
        if not os.path.exists(service_destination_path):
            os.makedirs(service_destination_path)
            
        # Lấy tên file thực thi
        executable_name = os.path.basename(executable_path)
        destination_path = os.path.join(service_destination_path, executable_name)
        
        # Nếu file đã nằm ở thư mục đích, ghi đè file thực thi
        if os.path.exists(destination_path):
            logger.info(f"File thực thi đã tồn tại, ghi đè tại {destination_path}")
            os.remove(destination_path)
            shutil.copy2(executable_path, destination_path)
            logger.info(f"Đã ghi đè file thực thi tại {destination_path}")
            return True, destination_path
        
        # Sao chép file, không di chuyển nó (để tiến trình hiện tại có thể tiếp tục chạy)
        shutil.copy2(executable_path, destination_path)
        logger.info(f"Đã sao chép file thực thi của agent đến {destination_path}")
        
        return True, destination_path
    except Exception as e:
        logger.error(f"Không thể di chuyển file thực thi: {str(e)}")
        return False, str(e)


def register_as_service(service_name, executable_path):
    """
    Đăng ký agent như một Windows service chạy dưới quyền admin
    
    Args:
        service_name (str): Tên của service
        executable_path (str): Đường dẫn đến file thực thi của agent
        
    Returns:
        tuple: (bool, str) - (Thành công/thất bại, thông báo)
    """
    try:
        # Sử dụng NSSM (Non-Sucking Service Manager) để tạo service
        # Kiểm tra xem NSSM đã được cài đặt chưa, nếu chưa thì cài đặt
        success, _ = choco_handle.install_package("nssm")
        if not success:
            return False, "Không thể cài đặt NSSM để tạo service"
            
        # Kiểm tra xem service đã tồn tại chưa
        check_cmd = subprocess.run(['sc', 'query', service_name], capture_output=True, text=True)
        if check_cmd.returncode == 0:
            # Service đã tồn tại, cập nhật nó
            logger.info(f"Service {service_name} đã tồn tại, đang cập nhật...")
            subprocess.run(['nssm', 'stop', service_name], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'Application', executable_path], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'AppDirectory', os.path.dirname(executable_path)], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'DisplayName', 'Remote Control Agent Service'], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'Description', 'Dịch vụ giúp quản lý máy tính từ xa'], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'Start', 'SERVICE_AUTO_START'], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'ObjectName', 'LocalSystem'], capture_output=True)
            subprocess.run(['nssm', 'start', service_name], capture_output=True)
        else:
            # Tạo service mới
            logger.info(f"Đang tạo service mới: {service_name}...")
            install_cmd = subprocess.run([
                'nssm', 'install', service_name, executable_path,
            ], capture_output=True, text=True)
            
            if install_cmd.returncode != 0:
                logger.error(f"Không thể tạo service: {install_cmd.stderr}")
                return False, f"Không thể tạo service: {install_cmd.stderr}"
            
            # Cấu hình service
            subprocess.run(['nssm', 'set', service_name, 'DisplayName', 'Remote Control Agent Service'], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'Description', 'Dịch vụ giúp quản lý máy tính từ xa'], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'Start', 'SERVICE_AUTO_START'], capture_output=True)
            subprocess.run(['nssm', 'set', service_name, 'ObjectName', 'LocalSystem'], capture_output=True)
            
            # Khởi động service
            start_cmd = subprocess.run(['nssm', 'start', service_name], capture_output=True, text=True)
            
            if start_cmd.returncode != 0:
                logger.error(f"Không thể khởi động service: {start_cmd.stderr}")
                return False, f"Không thể khởi động service: {start_cmd.stderr}"
        
        return True, f"Đã thành công đăng ký và khởi động service '{service_name}'"
    except Exception as e:
        logger.error(f"Không thể đăng ký service: {str(e)}")
        return False, str(e)