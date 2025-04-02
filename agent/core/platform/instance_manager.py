# agent/core/platform/instance_manager.py
import os
import sys
import subprocess
import threading
import time
import win32event
import win32api
import winerror
import agent.core.platform.startup_manager as startup_manager
import agent.core.utils.logger as logger

# --- Định danh duy nhất cho Mutex và Event ---
# !!! CRITICAL: This APP_GUID MUST be consistent across agent versions !!!
# If this GUID changes between versions, new versions cannot signal old ones to shutdown.
# Only change this if you want to completely break compatibility with previous versions.
APP_GUID = startup_manager.APP_GUID  # Use the same GUID from startup_manager
PREFIX = "Global\\" if startup_manager.is_admin() else ""  # Tự động chọn prefix dựa trên quyền
MUTEX_NAME = f"{PREFIX}RemoteControlAgentMutex_{APP_GUID}"
EVENT_NAME = f"{PREFIX}RemoteControlAgentShutdownEvent_{APP_GUID}"

class InstanceManager:
    def __init__(self):
        """Initialize InstanceManager with empty handles and thread objects"""
        self.mutex_handle = None
        self.event_handle = None
        self.shutdown_listener_thread = None
        self.stop_shutdown_listener = threading.Event()  # Cờ để dừng luồng listener
        
    def handle_instance_management(self):
        """
        Manages instance by using Mutex and Named Event to replace old instances.
        
        Returns:
            str: One of the following status codes:
                - "FIRST_INSTANCE": Current process is the only instance running
                - "EXIT_SIGNALED": Signal sent to existing instance, current process should exit
                - "ERROR": Critical error occurred during instance management
        """
        try:
            self.mutex_handle = win32event.CreateMutex(None, 1, MUTEX_NAME)
            last_error = win32api.GetLastError()
            
            if last_error == winerror.ERROR_ALREADY_EXISTS:
                logger.warning(f"Mutex '{MUTEX_NAME}' đã tồn tại. Gửi tín hiệu thay thế.")
                
                if self.mutex_handle:
                    win32api.CloseHandle(self.mutex_handle)
                    self.mutex_handle = None
                
                event_handle_to_signal = None
                try:
                    event_handle_to_signal = win32event.OpenEvent(
                        win32event.EVENT_MODIFY_STATE, False, EVENT_NAME
                    )
                    
                    if not event_handle_to_signal:
                        logger.error(f"Không thể mở Event '{EVENT_NAME}'. Lỗi: {win32api.GetLastError()}. Giả định có thể chạy.")
                        self.mutex_handle = win32event.CreateMutex(None, 1, MUTEX_NAME)
                        
                        if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
                            logger.error("Vẫn không thể tạo Mutex sau khi không mở được Event.")
                            return "ERROR"
                        
                        return self._setup_first_instance_event_and_listener()
                    
                    win32event.SetEvent(event_handle_to_signal)
                    logger.info(f"Đã gửi tín hiệu thành công qua Event '{EVENT_NAME}'.")
                    return "EXIT_SIGNALED"
                    
                except Exception as e:
                    logger.error(f"Lỗi khi gửi tín hiệu qua Event: {e}")
                    return "EXIT_SIGNALED"
                    
                finally:
                    if event_handle_to_signal:
                        win32api.CloseHandle(event_handle_to_signal)
                        
            elif last_error == 0:
                logger.info(f"Đã tạo Mutex '{MUTEX_NAME}' thành công.")
                return self._setup_first_instance_event_and_listener()
                
            else:
                logger.error(f"Lỗi không mong muốn khi tạo Mutex '{MUTEX_NAME}': {last_error}")
                return "ERROR"
                
        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng trong handle_instance_management: {e}")
            self.release_instance_handles()
            return "ERROR"
            
    def _setup_first_instance_event_and_listener(self):
        """
        Creates Named Event and starts listener thread for the first instance.
        
        Returns:
            str: "FIRST_INSTANCE" status code
        """
        try:
            self.event_handle = win32event.CreateEvent(None, True, False, EVENT_NAME)
            
            if not self.event_handle:
                logger.error(f"Không thể tạo Event '{EVENT_NAME}'. Lỗi: {win32api.GetLastError()}")
                return "FIRST_INSTANCE"
                
            logger.info(f"Đã tạo Event '{EVENT_NAME}' thành công.")
            self.stop_shutdown_listener.clear()
            self.shutdown_listener_thread = threading.Thread(target=self._shutdown_listener, daemon=True)
            self.shutdown_listener_thread.start()
            logger.info("Đã khởi chạy luồng lắng nghe tín hiệu shutdown.")
            
            return "FIRST_INSTANCE"
            
        except Exception as e:
            logger.error(f"Lỗi khi thiết lập Event/Listener: {e}")
            self.release_instance_handles()
            return "FIRST_INSTANCE"
            
    def _shutdown_listener(self):
        """Background thread that waits for Event signal to restart the application."""
        logger.info(f"Luồng lắng nghe ({threading.get_ident()}) bắt đầu, đợi Event '{EVENT_NAME}'.")
        
        while not self.stop_shutdown_listener.is_set():
            try:
                result = win32event.WaitForSingleObject(self.event_handle, 1000)
                
                if self.stop_shutdown_listener.is_set():
                    logger.info(f"Luồng lắng nghe ({threading.get_ident()}) nhận tín hiệu dừng từ bên ngoài.")
                    break
                    
                if result == win32event.WAIT_OBJECT_0:
                    logger.warning(f"Luồng lắng nghe ({threading.get_ident()}) nhận được tín hiệu thay thế!")
                    logger.warning("Chuẩn bị đóng instance hiện tại và khởi chạy lại...")
                    
                    # Signal any cleanup callbacks before restarting
                    if hasattr(self, 'cleanup_callback') and callable(self.cleanup_callback):
                        try:
                            self.cleanup_callback(is_relaunching=True)
                        except Exception as cleanup_err:
                            logger.error(f"Error in cleanup callback during restart: {cleanup_err}")
                    
                    time.sleep(1)
                    executable = sys.executable
                    args = sys.argv
                    logger.info(f"Khởi chạy lại: {executable} {' '.join(args)}")
                    
                    try:
                        subprocess.Popen(
                            [executable] + args[1:], 
                            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
                        )
                        logger.info("Đã khởi chạy tiến trình mới.")
                        
                    except Exception as relaunch_error:
                        logger.error(f"LỖI: Không thể khởi chạy lại ứng dụng: {relaunch_error}")
                    
                    logger.warning(f"Thoát instance cũ (PID: {os.getpid()}) ngay lập tức.")
                    os._exit(1)
                    
                elif result == win32event.WAIT_TIMEOUT:
                    continue
                    
                else:
                    logger.error(f"Lỗi WaitForSingleObject trong luồng lắng nghe: {win32api.GetLastError()}")
                    break
                    
            except Exception as e:
                logger.error(f"Lỗi không mong muốn trong luồng lắng nghe: {e}")
                break
                
        logger.info(f"Luồng lắng nghe ({threading.get_ident()}) kết thúc.")
        
    def release_instance_handles(self):
        """Safely releases Mutex and Event resources."""
        if hasattr(self, 'mutex_handle') and self.mutex_handle:
            try:
                win32api.CloseHandle(self.mutex_handle)
                self.mutex_handle = None
                logger.info("Mutex handle released.")
            except Exception as e:
                logger.error(f"Error releasing mutex handle: {e}")
                
        if hasattr(self, 'event_handle') and self.event_handle:
            try:
                win32api.CloseHandle(self.event_handle)
                self.event_handle = None
                logger.info("Event handle released.")
            except Exception as e:
                logger.error(f"Error releasing event handle: {e}")
                
    def stop(self):
        """Stops the shutdown listener thread and releases resources."""
        logger.info("Stopping InstanceManager...")
        
        if hasattr(self, 'stop_shutdown_listener') and not self.stop_shutdown_listener.is_set():
            self.stop_shutdown_listener.set()
            logger.info("Signaled shutdown listener thread to stop.")
            
        current_thread_id = threading.get_ident()
        listener_thread_id = self.shutdown_listener_thread.ident if hasattr(self, 'shutdown_listener_thread') and self.shutdown_listener_thread else None
        
        if listener_thread_id and current_thread_id != listener_thread_id and self.shutdown_listener_thread.is_alive():
            logger.info("Waiting for shutdown listener thread to finish...")
            self.shutdown_listener_thread.join(timeout=2)
            
            if self.shutdown_listener_thread.is_alive():
                logger.warning("Shutdown listener thread did not finish in time.")
            else:
                logger.info("Shutdown listener thread finished.")
                
        elif listener_thread_id and current_thread_id == listener_thread_id:
            logger.info("Stop called from within shutdown listener thread, skipping join.")
            
        logger.info("Releasing instance handles...")
        self.release_instance_handles()
        logger.info("Instance handles released.")
        
    def set_cleanup_callback(self, callback):
        """Sets a cleanup callback function to be called before restarting."""
        self.cleanup_callback = callback