import os
import sys
import logging
from logging.handlers import RotatingFileHandler
import tempfile

# Global variable to store the initialized logger instance
_logger = None
_log_file_path = None # Store the log file path globally

# Configuration constants
LOG_DIR_NAME = "RemoteControlAgent"
LOG_FILE_NAME = "agent.log"
MAX_LOG_SIZE_MB = 10
LOG_BACKUP_COUNT = 5
LOG_FORMAT = "%(asctime)s - %(levelname)s - [%(threadName)s] - %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

def setup_logger():
    """Configures and returns a logger instance for the application.

    This logger will:
    - Write to a rotating log file in %APPDATA%\RemoteControlAgent\logs (or a temp dir if APPDATA is unavailable).
    - Use UTF-8 encoding with BOM (utf-8-sig) for better compatibility on Windows.
    - Capture and log uncaught exceptions (except KeyboardInterrupt).

    Returns:
        logging.Logger: The configured logger instance.
    """
    global _logger, _log_file_path
    if _logger:
        return _logger # Return the existing logger if already initialized

    try:
        # 1. Determine log directory
        # Prefer APPDATA as it's user-specific and usually writable.
        appdata_dir = os.getenv("APPDATA")
        if appdata_dir and os.path.isdir(appdata_dir):
            log_dir_base = appdata_dir
        else:
            # Fallback to temp directory if APPDATA is not available or invalid
            log_dir_base = tempfile.gettempdir()
            print(f"Warning: APPDATA environment variable not found or invalid. Using temp directory: {log_dir_base}")

        log_dir = os.path.join(log_dir_base, LOG_DIR_NAME, "logs")

        # Create log directory if it doesn't exist
        os.makedirs(log_dir, exist_ok=True)

        # 2. Configure the main logger object
        logger = logging.getLogger("RemoteControlAgent")
        logger.setLevel(logging.INFO) # Default logging level
        # Prevent messages from propagating to the root logger (avoids duplicate logs)
        logger.propagate = False

        # 3. Configure Rotating File Handler
        _log_file_path = os.path.join(log_dir, LOG_FILE_NAME)
        # Rotate logs when they reach MAX_LOG_SIZE_MB, keep LOG_BACKUP_COUNT backups.
        # Use 'utf-8-sig' encoding to include BOM, helping Windows text editors recognize UTF-8.
        file_handler = RotatingFileHandler(
            _log_file_path,
            maxBytes=MAX_LOG_SIZE_MB * 1024 * 1024,
            backupCount=LOG_BACKUP_COUNT,
            encoding="utf-8-sig",
        )

        # 4. Configure Formatter
        formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
        file_handler.setFormatter(formatter)

        # 5. Add Handler to Logger
        # Add handler only if no similar handler already exists (prevents duplicates on re-setup)
        if not any(isinstance(h, RotatingFileHandler) for h in logger.handlers):
             logger.addHandler(file_handler)
             print(f"File handler added for log file: {_log_file_path}")
        else:
             print(f"File handler for {_log_file_path} already exists.")

        # --- Optional: Console Handler (for immediate feedback during development/debugging) ---
        # console_handler = logging.StreamHandler(sys.stdout)
        # console_handler.setFormatter(formatter)
        # console_handler.setLevel(logging.DEBUG) # Show more detail on console
        # if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
        #     logger.addHandler(console_handler)
        #     print("Console handler added.")
        # ------------------------------------------------------------------------------------

        # 6. Configure Uncaught Exception Handling
        def handle_uncaught_exception(exc_type, exc_value, exc_traceback):
            """Logs critical errors for uncaught exceptions."""
            # Ignore KeyboardInterrupt to allow stopping with Ctrl+C
            if issubclass(exc_type, KeyboardInterrupt):
                # Call the original excepthook for KeyboardInterrupt
                sys.__excepthook__(exc_type, exc_value, exc_traceback)
                return
            # Log the uncaught exception with full traceback
            # Use the already configured logger instance
            if _logger:
                 _logger.critical("Uncaught exception occurred:", exc_info=(exc_type, exc_value, exc_traceback))
            else:
                 # Fallback if logger setup failed somehow before this hook was set
                 print(f"FATAL UNCAUGHT EXCEPTION (logger not fully available): {exc_value}", file=sys.stderr)

        # Assign the custom excepthook only once
        if sys.excepthook is sys.__excepthook__:
             sys.excepthook = handle_uncaught_exception
             print("Uncaught exception handler installed.")
        else:
             print("Uncaught exception handler seems to be already installed.")

        _logger = logger # Store the successfully configured logger
        print(f"Logger initialization complete. Logging to: {_log_file_path}")
        _logger.info("--- Logger initialized ---") # Add an entry to the log file itself
        return logger

    except Exception as e:
        # If a critical error occurs during logger setup, print to stderr
        # and provide a basic fallback logger to prevent None errors.
        print(f"FATAL: Failed to setup logger: {e}", file=sys.stderr)
        logging.basicConfig(level=logging.ERROR)
        _logger = logging.getLogger("RemoteControlAgent_Fallback")
        _logger.error(f"Failed to initialize file logger: {e}. Using basic console logging.")
        _log_file_path = "Error: Logging to console only"
        return _logger

# Initialize the logger immediately when the module is imported
logger = setup_logger()

# ---- Convenience functions for logging from other modules ----

def get_log_file_path():
    """Returns the path to the current log file."""
    return _log_file_path

def info(message, *args, **kwargs):
    """Logs an informational message."""
    logger.info(message, *args, **kwargs)

def error(message, *args, exc_info=None, **kwargs):
    """Logs an error message. Automatically includes exception info if an exception is passed.

    Args:
        message (str): The message to log.
        *args: Arguments to format the message string.
        exc_info (bool | tuple | Exception, optional): Controls exception information logging.
            - If None (default) and an Exception object is passed in args, logs exception info.
            - If True, logs exception info from sys.exc_info().
            - If a tuple (type, value, traceback), logs it.
            - If an Exception instance, logs it.
            - If False, suppresses exception info.
    """
    # Automatically set exc_info=True if the first arg is an exception instance
    if exc_info is None:
        if args and isinstance(args[0], BaseException):
            exc_info = True # Log the exception passed in args
        else:
            exc_info = False # Default to no traceback for simple errors

    logger.error(message, *args, exc_info=exc_info, **kwargs)

def warning(message, *args, **kwargs):
    """Logs a warning message."""
    logger.warning(message, *args, **kwargs)

def debug(message, *args, **kwargs):
    """Logs a debug message (only if logger level is set to DEBUG)."""
    logger.debug(message, *args, **kwargs)

def critical(message, *args, exc_info=True, **kwargs):
    """Logs a critical error message. Always includes exception info by default."""
    logger.critical(message, *args, exc_info=exc_info, **kwargs)
