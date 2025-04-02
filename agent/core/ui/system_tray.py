import pystray
from PIL import Image, UnidentifiedImageError, ImageDraw
import threading
import os
import sys
import agent.core.utils.logger as logger
import agent.core.platform.startup_manager as startup_manager

def create_default_icon():
    """
    Creates a simple default icon when the icon file can't be loaded
    """
    # Create a simple default icon (a blue square)
    width = 64
    height = 64
    color = (0, 120, 212)  # Blue color
    
    image = Image.new('RGB', (width, height), color=color)
    draw = ImageDraw.Draw(image)
    
    # Add a simple design (white border)
    border_width = 3
    draw.rectangle(
        [(border_width, border_width), 
         (width - border_width, height - border_width)], 
        outline=(255, 255, 255)
    )
    
    logger.info("Created a default icon because the icon file could not be loaded")
    return image

def get_icon_path():
    try:
        # First try to find the icon in the build directory
        base_dir = None
        if getattr(sys, 'frozen', False):
            # Running as exe (frozen)
            base_dir = os.path.dirname(sys.executable)
            if os.path.basename(base_dir) == 'dist':
                base_dir = os.path.dirname(base_dir)
            logger.debug(f"Running frozen, base directory for icon search: {base_dir}")
        else:
            # Running as script
            script_dir = os.path.dirname(os.path.abspath(__file__))
            # Go up to project root (4 levels up from ui dir)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(script_dir)))
            logger.debug(f"Running from source, base directory for icon search: {base_dir}")
        
        # Try several possible paths for the icon
        possible_paths = [
            # Standard path
            os.path.join(base_dir, 'agent', 'build', 'icon.ico'),
            # Alternative path
            os.path.join(os.path.dirname(base_dir), 'agent', 'build', 'icon.ico'),
            # Direct executable directory
            os.path.join(os.path.dirname(sys.executable), 'icon.ico'),
            # Path relative to ui directory
            os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'build', 'icon.ico')
        ]
        
        for path in possible_paths:
            norm_path = os.path.normpath(path)
            if os.path.exists(norm_path):
                logger.info(f"Found icon at: {norm_path}")
                return norm_path
                
        logger.warning("Icon file not found in any of the expected locations. Will use default icon.")
        return None

    except Exception as e:
        logger.error(f"Error determining icon path: {e}")
        return None

class SystemTrayIcon:
    def __init__(self, update_config_callback=None, register_startup_callback=None, unregister_startup_callback=None):
        self.update_config_callback = update_config_callback
        self.register_startup_callback = register_startup_callback
        self.unregister_startup_callback = unregister_startup_callback

        self._icon = None
        self._tray_thread = None
        self._status_text = "Initializing"
        self._is_registered_for_startup = False
        self._icon_path = get_icon_path()
        self._stop_event = threading.Event()

        logger.info("SystemTrayIcon initialized.")

    def _status_action(self):
        pass

    def _register_startup(self, icon=None, item=None):
        if self.register_startup_callback:
            logger.info("'Register for Startup' selected from tray menu.")
            threading.Thread(target=self.register_startup_callback, daemon=True).start()
        else:
            logger.warning("'Register for Startup' selected, but no callback is configured.")

    def _unregister_startup(self, icon=None, item=None):
        if self.unregister_startup_callback:
            logger.info("'Unregister from Startup' selected from tray menu.")
            threading.Thread(target=self.unregister_startup_callback, daemon=True).start()
        else:
            logger.warning("'Unregister from Startup' selected, but no callback is configured.")

    def _update_config(self, icon=None, item=None):
        if not startup_manager.is_admin():
             logger.warning("'Update Config' selected, but user lacks admin rights.")
             return

        if self.update_config_callback:
            logger.info("'Update Config' selected from tray menu (Admin)." )
            threading.Thread(target=self.update_config_callback, daemon=True).start()
        else:
            logger.error("'Update Config' selected, but no callback is configured.")

    def _exit_app(self, icon=None, item=None):
         logger.info("'Exit' selected from tray menu. Initiating shutdown.")
         self.stop()
         logger.info("Exiting application process...")
         os._exit(0)

    def _setup_menu(self):
        logger.debug("Setting up tray menu...")
        menu_items = [
            pystray.MenuItem(f'Status: {self._status_text}', self._status_action, enabled=False),
            pystray.Menu.SEPARATOR
        ]

        is_currently_admin = startup_manager.is_admin()
        logger.debug(f"Admin status for menu setup: {is_currently_admin}")
        if is_currently_admin:
            menu_items.append(pystray.MenuItem('Update Config', self._update_config))
            if self._is_registered_for_startup:
                 menu_items.append(pystray.MenuItem('Unregister from Startup', self._unregister_startup))
            else:
                 menu_items.append(pystray.MenuItem('Register for Startup', self._register_startup))
            menu_items.append(pystray.Menu.SEPARATOR)
        else:
             menu_items.append(pystray.MenuItem('Update Config (Admin required)', None, enabled=False))
             menu_items.append(pystray.MenuItem('Manage Startup (Admin required)', None, enabled=False))
             menu_items.append(pystray.Menu.SEPARATOR)

        menu_items.append(pystray.MenuItem('Exit', self._exit_app))

        return pystray.Menu(*menu_items)

    def _load_icon_image(self):
        if not self._icon_path:
            logger.warning("No icon path found, using generated default icon.")
            return create_default_icon()
            
        try:
            image = Image.open(self._icon_path)
            logger.debug(f"Successfully loaded icon image from: {self._icon_path}")
            return image
        except FileNotFoundError:
            logger.error(f"Icon file not found at path: {self._icon_path}")
            return create_default_icon()
        except UnidentifiedImageError:
            logger.error(f"Cannot identify image file (is it a valid .ico?): {self._icon_path}")
            return create_default_icon()
        except Exception as e:
            logger.error(f"Failed to load icon image from '{self._icon_path}': {e}")
            return create_default_icon()

    def _run_tray_thread(self):
        logger.info("System tray thread started.")
        try:
            image = self._load_icon_image()

            self._icon = pystray.Icon(
                 "RemoteControlAgent",
                 image,
                 "Remote Control Agent",
                 menu=self._setup_menu()
            )
            self._icon.run()

        except Exception as e:
            logger.critical(f"Fatal error in system tray thread: {e}", exc_info=True)
        finally:
            logger.info("System tray thread finished.")

    def update_status(self, status_text):
        self._status_text = status_text
        logger.debug(f"Updating tray status to: {status_text}")
        if self._icon and self._icon.visible:
            self._icon.menu = self._setup_menu()

    def update_startup_status(self, is_registered):
         self._is_registered_for_startup = is_registered
         logger.debug(f"Updating tray startup registration status to: {is_registered}")
         if self._icon and self._icon.visible:
             self._icon.menu = self._setup_menu()

    def start(self):
        if self._tray_thread and self._tray_thread.is_alive():
            logger.warning("System tray thread is already running.")
            return

        logger.info("Starting system tray thread...")
        self._stop_event.clear()
        self._tray_thread = threading.Thread(target=self._run_tray_thread, name="SystemTrayThread", daemon=True)
        self._tray_thread.start()

    def stop(self):
        logger.info("Attempting to stop system tray...")
        if self._icon:
            try:
                self._icon.stop()
                logger.info("Sent stop signal to pystray icon.")
            except Exception as e:
                 logger.error(f"Error sending stop signal to pystray: {e}")

        if self._tray_thread and self._tray_thread.is_alive():
            logger.debug("Waiting for system tray thread to join...")
            self._tray_thread.join(timeout=2)
            if self._tray_thread.is_alive():
                  logger.warning("System tray thread did not stop within the timeout period.")
            else:
                 logger.info("System tray thread joined successfully.")
        else:
             logger.debug("System tray thread was not running or already stopped.")

        self._icon = None
        self._tray_thread = None