import pystray
from PIL import Image, UnidentifiedImageError
import threading
import os
import sys

from . import logger
from . import startup_manager

def get_icon_path():
    try:
        base_dir = None
        if getattr(sys, 'frozen', False):
            base_dir = os.path.dirname(sys.executable)
            if os.path.basename(base_dir) == 'dist':
                 base_dir = os.path.dirname(base_dir)
            logger.debug(f"Running frozen, base directory for icon search: {base_dir}")
        else:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(script_dir))))
            logger.debug(f"Running from source, base directory for icon search: {base_dir}")

        icon_path = os.path.join(base_dir, 'agent', 'build', 'icon.ico')
        icon_path = os.path.normpath(icon_path)

        if not os.path.exists(icon_path):
            logger.warning(f"Icon file not found at expected path: {icon_path}. Trying alternative project structure.")
            if not getattr(sys, 'frozen', False):
                alt_icon_path = os.path.join(os.path.dirname(base_dir), 'agent', 'build', 'icon.ico')
                alt_icon_path = os.path.normpath(alt_icon_path)
                if os.path.exists(alt_icon_path):
                     logger.info(f"Found icon using alternative path: {alt_icon_path}")
                     return alt_icon_path
                else:
                    logger.warning(f"Alternative icon path also not found: {alt_icon_path}. Using pystray default.")
                    return None
            else:
                 logger.warning(f"Still not found after checking base dir. Using pystray default.")
                 return None

        logger.info(f"Using icon file found at: {icon_path}")
        return icon_path

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
            logger.warning("No icon path specified, using pystray default icon.")
            return None
        try:
            image = Image.open(self._icon_path)
            logger.debug(f"Successfully loaded icon image from: {self._icon_path}")
            return image
        except FileNotFoundError:
             logger.error(f"Icon file not found at path: {self._icon_path}")
             return None
        except UnidentifiedImageError:
            logger.error(f"Cannot identify image file (is it a valid .ico?): {self._icon_path}")
            return None
        except Exception as e:
            logger.error(f"Failed to load icon image from '{self._icon_path}': {e}")
            return None

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