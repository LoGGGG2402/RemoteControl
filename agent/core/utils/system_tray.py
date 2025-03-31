import os
import sys
import threading
import ctypes
import logging

logger = logging.getLogger(__name__)

# Try to import pystray, but provide a fallback if it's not available
try:
    import pystray
    from PIL import Image, ImageDraw
    PYSTRAY_AVAILABLE = True
except ImportError:
    logger.warning("pystray module not available. System tray functionality will be disabled.")
    PYSTRAY_AVAILABLE = False

def is_admin():
    """
    Kiểm tra xem ứng dụng có đang chạy với quyền admin hay không
    
    Returns:
        bool: True nếu đang chạy với quyền admin, False nếu không
    """
    try:
        return ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False

class SystemTrayIcon:
    def __init__(self, update_config_callback=None):
        """
        Khởi tạo biểu tượng System Tray
        
        Args:
            update_config_callback (function): Callback được gọi khi admin chọn "Update Config"
        """
        self.update_config_callback = update_config_callback
        self.icon = None
        self.stop_event = threading.Event()
        self.tray_thread = None
        self.status_text = "Starting"

    def _create_image(self, width=64, height=64, color="blue"):
        """Tạo một hình ảnh đơn giản cho biểu tượng"""
        if not PYSTRAY_AVAILABLE:
            return None
            
        # Tạo ảnh trống
        image = Image.new('RGB', (width, height), color='white')
        dc = ImageDraw.Draw(image)
        
        # Vẽ hình tròn màu xanh
        dc.ellipse([8, 8, width - 8, height - 8], fill=color)
        
        # Vẽ chữ "RC" (Remote Control) ở giữa
        #dc.text((width//2, height//2), "RC", fill='white')
        
        return image

    def _status_action(self):
        """Empty action for status menu item"""
        pass
        
    def _setup_icon(self):
        """Thiết lập biểu tượng và menu"""
        if not PYSTRAY_AVAILABLE:
            return
            
        image = self._create_image()
        
        # Menu items cơ bản
        menu_items = [
            pystray.MenuItem(f'Status: {self.status_text}', self._status_action, enabled=False),
            pystray.MenuItem('Show', self._show_app)
        ]
        
        # Chỉ thêm nút "Update Config" nếu có quyền admin
        if is_admin():
            menu_items.append(pystray.MenuItem('Update Config', self._update_config))
        
        self.icon = pystray.Icon("RemoteControl", image, "Remote Control Agent", pystray.Menu(*menu_items))

    def _update_config(self, icon, item):
        """Xử lý sự kiện khi admin chọn "Update Config" từ menu"""
        if is_admin() and self.update_config_callback:
            self.update_config_callback()
        else:
            logger.warning("Attempted to update config without admin rights")

    def _show_app(self, icon, item):
        """Hiển thị cửa sổ ứng dụng chính (nếu có)"""
        # Có thể thêm code để hiển thị UI của ứng dụng nếu cần
        logger.info("Show app requested from system tray")

    def update_status(self, status_text):
        """Cập nhật trạng thái hiển thị trong menu"""
        if not PYSTRAY_AVAILABLE:
            logger.info(f"Status updated: {status_text}")
            return
            
        # Store the status text for future menu rebuilds
        self.status_text = status_text
        
        if self.icon and hasattr(self.icon, 'menu'):
            # Recreate the entire menu with the updated status text
            menu_items = [
                pystray.MenuItem(f'Status: {status_text}', self._status_action, enabled=False),
                pystray.MenuItem('Show', self._show_app)
            ]
            
            # Add "Update Config" if user is admin
            if is_admin():
                menu_items.append(pystray.MenuItem('Update Config', self._update_config))
            
            # Update the icon's menu
            self.icon.menu = pystray.Menu(*menu_items)

    def start(self):
        """Khởi chạy biểu tượng System Tray trong một thread riêng"""
        if not PYSTRAY_AVAILABLE:
            logger.info("System tray functionality is disabled")
            return
            
        def run_icon():
            self._setup_icon()
            self.icon.run()
            
        self.tray_thread = threading.Thread(target=run_icon, daemon=True)
        self.tray_thread.start()
        logger.info("System Tray icon started")
        
    def stop(self):
        """Dừng biểu tượng System Tray"""
        if not PYSTRAY_AVAILABLE:
            return
            
        if self.icon:
            self.icon.stop()
            logger.info("System Tray icon stopped")