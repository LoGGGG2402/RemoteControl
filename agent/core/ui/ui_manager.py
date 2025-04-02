# agent/core/ui/ui_manager.py
import agent.core.utils.logger as logger
from agent.core.ui.dialogs import SetupDialog, ProgressDialog
from agent.core.ui.message_boxes import show_error, show_info, show_question

class UIManager:
    """
    Central manager for UI interactions, providing a clean interface for
    other components to display UI elements without direct dependencies.
    """
    
    def __init__(self):
        """Initialize the UI Manager"""
        self.system_tray = None
        
    def set_system_tray(self, system_tray):
        """
        Set the system tray reference
        
        Args:
            system_tray: SystemTrayIcon instance
        """
        self.system_tray = system_tray
        
    def update_status(self, status_text):
        """
        Update the status text in the system tray
        
        Args:
            status_text (str): Status text to display
        """
        if self.system_tray:
            self.system_tray.update_status(status_text)
            
    def update_startup_status(self, is_registered):
        """
        Update the startup status in the system tray
        
        Args:
            is_registered (bool): Whether the application is registered to start at boot
        """
        if self.system_tray:
            self.system_tray.update_startup_status(is_registered)
            
    def show_error(self, title, message):
        """
        Display an error message box
        
        Args:
            title (str): Error title
            message (str): Error message
        """
        logger.warning(f"Showing error dialog: {title} - {message}")
        show_error(title, message)
        
    def show_info(self, title, message):
        """
        Display an information message box
        
        Args:
            title (str): Info title
            message (str): Info message
        """
        logger.info(f"Showing info dialog: {title} - {message}")
        show_info(title, message)
        
    def show_question(self, title, message, options=None):
        """
        Display a question dialog with custom buttons
        
        Args:
            title (str): Question title
            message (str): Question message
            options (list): List of button labels
            
        Returns:
            str: Selected option
        """
        return show_question(title, message, options)
        
    def request_config_setup(self):
        """
        Display configuration setup dialog for first-time setup
        
        Returns:
            dict: Configuration dictionary or None if cancelled
        """
        logger.info("Displaying configuration setup dialog")
        dialog = SetupDialog()
        return dialog.get_result()
        
    def request_config_update(self, current_config):
        """
        Display configuration update dialog with current values
        
        Args:
            current_config (dict): Current configuration values
            
        Returns:
            dict: Updated configuration dictionary or None if cancelled
        """
        logger.info("Displaying configuration update dialog")
        dialog = SetupDialog(initial_values=current_config)
        return dialog.get_result()
        
    def show_progress(self, title="Please wait", message="Operation in progress..."):
        """
        Show a progress dialog for long-running operations
        
        Args:
            title (str): Progress dialog title
            message (str): Progress message
            
        Returns:
            ProgressDialog: Progress dialog instance for updating/closing
        """
        logger.info(f"Showing progress dialog: {title} - {message}")
        return ProgressDialog(title, message)