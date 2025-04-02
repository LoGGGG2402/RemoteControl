# agent/core/initializer.py
import sys
import platform
import agent.core.utils.logger as logger
import agent.core.helper.choco_handle as choco_handle
import agent.core.platform.startup_manager as startup_manager

class AgentInitializer:
    """
    Responsible for handling agent initialization tasks like:
    - Checking/Installing Chocolatey
    - Ensuring correct installation location
    - Registering startup tasks
    """
    
    def __init__(self, ui_manager=None):
        """
        Initialize the AgentInitializer with an optional UI manager
        
        Args:
            ui_manager: Optional UIManager for displaying status and errors
        """
        self.ui_manager = ui_manager
        self.install_path = startup_manager.get_install_path()
        
    def initialize(self):
        """
        Run all initialization steps and return the result
        
        Returns:
            dict: Status information with the following keys:
                - success (bool): Whether initialization was successful
                - message (str): Description of the result or error
                - requires_admin (bool): Whether admin rights are needed
                - executable_path (str): Final executable path after initialization
        """
        if platform.system() != 'Windows':
            logger.error("This agent only runs on Windows. Exiting.")
            return {
                "success": False,
                "message": "This agent only runs on Windows.",
                "requires_admin": False,
                "executable_path": None
            }
            
        # Step 1: Check and install Chocolatey if needed
        choco_result = self._initialize_chocolatey()
        if not choco_result["success"] and choco_result["requires_admin"]:
            return choco_result
            
        # Step 2: Ensure application is in the correct location
        location_result = self._ensure_correct_location()
        if not location_result["success"]:
            return location_result
            
        # Step 3: Register startup task if running as admin
        startup_result = self._register_startup_task(location_result["executable_path"])
        
        # Return combined result
        return {
            "success": True,
            "message": "Agent initialization completed successfully.",
            "requires_admin": False,
            "executable_path": location_result["executable_path"],
            "startup_registered": startup_result["success"],
            "startup_message": startup_result["message"]
        }
        
    def _initialize_chocolatey(self):
        """
        Check if Chocolatey is installed and install it if necessary
        
        Returns:
            dict: Result of Chocolatey initialization
        """
        if self.ui_manager:
            self.ui_manager.update_status("Checking Choco...")
            
        logger.info("Checking if Chocolatey is installed...")
        
        if not choco_handle.is_chocolatey_installed():
            logger.info("Chocolatey not found. Attempting installation...")
            
            if self.ui_manager:
                self.ui_manager.update_status("Installing Choco...")
                
            if not startup_manager.is_admin():
                logger.error("Admin rights required to install Chocolatey.")
                
                if self.ui_manager:
                    self.ui_manager.show_error(
                        "Admin Rights Required", 
                        "Chocolatey needs to be installed, but this requires Administrator rights.\n"
                        "Please run the agent as Administrator once."
                    )
                    self.ui_manager.update_status("Error: Choco Install Requires Admin")
                    
                return {
                    "success": False,
                    "message": "Admin rights required to install Chocolatey.",
                    "requires_admin": True
                }
                
            success, message = choco_handle.install_chocolatey()
            
            if not success:
                logger.error(f"Failed to install Chocolatey: {message}")
                
                if self.ui_manager:
                    self.ui_manager.show_error("Error", f"Failed to install Chocolatey: {message}")
                    self.ui_manager.update_status("Error: Choco Install Failed")
                    
                return {
                    "success": False,
                    "message": f"Failed to install Chocolatey: {message}",
                    "requires_admin": True
                }
                
            logger.info("Chocolatey installed successfully.")
            
            if self.ui_manager:
                self.ui_manager.update_status("Choco Installed")
        else:
            logger.info("Chocolatey is already installed.")
            
            if self.ui_manager:
                self.ui_manager.update_status("Choco OK")
                
        return {
            "success": True,
            "message": "Chocolatey is ready.",
            "requires_admin": False
        }
        
    def _ensure_correct_location(self):
        """
        Ensure the application is running from the correct location
        
        Returns:
            dict: Result of location verification
        """
        if self.ui_manager:
            self.ui_manager.update_status("Checking location...")
            
        logger.info("Ensuring application is in the correct location...")
        
        location_ok, final_path_or_error = startup_manager.ensure_correct_location(allow_exit=True)
        
        if not location_ok:
            logger.error(f"Failed to ensure correct application location: {final_path_or_error}")
            
            if self.ui_manager:
                self.ui_manager.show_error(
                    "Installation Error", 
                    f"Could not move application to the correct location:\n{final_path_or_error}"
                )
                self.ui_manager.update_status("Error: Location Setup Failed")
                
            return {
                "success": False,
                "message": f"Could not move application to the correct location: {final_path_or_error}",
                "requires_admin": False,
                "executable_path": None
            }
            
        logger.info(f"Application is at the correct location: {final_path_or_error}")
        
        if self.ui_manager:
            self.ui_manager.update_status("Location OK")
            
        return {
            "success": True,
            "message": "Application is at the correct location.",
            "requires_admin": False,
            "executable_path": final_path_or_error
        }
        
    def _register_startup_task(self, executable_path):
        """
        Register the application to run at startup if running as admin
        
        Args:
            executable_path (str): Path to the executable
            
        Returns:
            dict: Result of startup task registration
        """
        # Only attempt to register if running as admin
        if not startup_manager.is_admin():
            logger.info("Not running as admin, skipping startup task registration check.")
            
            # Still check if task exists even if we can't register it
            startup_status = startup_manager.check_startup_task_exists()
            logger.info(f"Startup task exists: {startup_status}")
            
            if self.ui_manager:
                self.ui_manager.update_startup_status(startup_status)
                
            return {
                "success": startup_status,
                "message": "Startup task already registered." if startup_status else "Not running as admin, skipping startup registration.",
                "requires_admin": not startup_status
            }
            
        # If running as admin, check and register if needed
        if self.ui_manager:
            self.ui_manager.update_status("Checking Startup Task...")
            
        logger.info("Checking if startup task exists...")
        task_exists = startup_manager.check_startup_task_exists()
        
        if not task_exists:
            logger.info("Startup task not found. Attempting to register...")
            
            if self.ui_manager:
                self.ui_manager.update_status("Registering Startup...")
                
            success_reg, msg_reg = startup_manager.register_startup_task(executable_path)
            
            if success_reg:
                logger.info(f"Startup task registered successfully: {msg_reg}")
                
                if self.ui_manager:
                    self.ui_manager.update_status("Startup Registered")
                    self.ui_manager.update_startup_status(True)
                    
                return {
                    "success": True,
                    "message": f"Startup task registered successfully: {msg_reg}",
                    "requires_admin": False
                }
            else:
                logger.error(f"Failed to register startup task: {msg_reg}")
                
                if self.ui_manager:
                    self.ui_manager.update_status("Error: Startup Reg Failed")
                    self.ui_manager.update_startup_status(False)
                    
                return {
                    "success": False,
                    "message": f"Failed to register startup task: {msg_reg}",
                    "requires_admin": True
                }
        else:
            logger.info("Startup task already exists.")
            
            if self.ui_manager:
                self.ui_manager.update_status("Startup OK")
                self.ui_manager.update_startup_status(True)
                
            return {
                "success": True,
                "message": "Startup task already registered.",
                "requires_admin": False
            }
            
    def register_startup(self):
        """
        Public method to register the application at startup (callback for UI)
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not startup_manager.is_admin():
            if self.ui_manager:
                self.ui_manager.show_error(
                    "Admin Rights Required", 
                    "Registering startup tasks requires Administrator rights.\n"
                    "Please run the agent as Administrator to perform this action."
                )
            return False
            
        result = self._register_startup_task(self.install_path)
        return result["success"]
        
    def unregister_startup(self):
        """
        Public method to unregister the application from startup (callback for UI)
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not startup_manager.is_admin():
            if self.ui_manager:
                self.ui_manager.show_error(
                    "Admin Rights Required", 
                    "Unregistering startup tasks requires Administrator rights.\n"
                    "Please run the agent as Administrator to perform this action."
                )
            return False
            
        logger.info("User requested to unregister startup task")
        
        try:
            success, message = startup_manager.unregister_startup_task()
            
            if success:
                logger.info(f"Startup task unregistered successfully: {message}")
                if self.ui_manager:
                    self.ui_manager.update_startup_status(False)
            else:
                logger.error(f"Failed to unregister startup task: {message}")
                if self.ui_manager:
                    self.ui_manager.show_error("Error", f"Failed to unregister startup task: {message}")
                    
            return success
            
        except Exception as e:
            logger.error(f"Error in unregister_startup: {e}")
            if self.ui_manager:
                self.ui_manager.show_error("Error", f"Failed to unregister startup task: {e}")
            return False
            
    def set_ui_manager(self, ui_manager):
        """Set the UI manager for displaying status and errors"""
        self.ui_manager = ui_manager