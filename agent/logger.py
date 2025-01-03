import os
import logging
from logging.handlers import RotatingFileHandler
import sys
import locale


def setup_logger():
    # Đặt encoding mặc định cho hệ thống
    if sys.platform.startswith("win"):
        locale.setlocale(locale.LC_ALL, "Vietnamese_Vietnam.1258")

    # Tạo thư mục logs nếu chưa tồn tại
    log_dir = os.path.join(os.getenv("APPDATA"), "RemoteControl", "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    # Cấu hình logger
    logger = logging.getLogger("RemoteControlAgent")
    logger.setLevel(logging.INFO)

    # Handler cho file log với rotation và encoding UTF-8
    log_file = os.path.join(log_dir, "agent.log")
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8-sig",  # Sử dụng UTF-8 với BOM
    )

    # Format log với encoding UTF-8
    formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # Console handler với encoding UTF-8
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)
    logger.addHandler(console_handler)

    # Bắt các exception không được handle
    def handle_exception(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        logger.error(
            "Uncaught exception", exc_info=(exc_type, exc_value, exc_traceback)
        )

    sys.excepthook = handle_exception

    return logger


# Khởi tạo logger global
logger = setup_logger()


# Thêm các hàm wrapper để export
def info(message):
    logger.info(message)


def error(message):
    logger.info(message)


def warning(message):
    logger.warning(message)


def debug(message):
    logger.debug(message)
