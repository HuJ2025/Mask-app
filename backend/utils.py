import os
import shutil
import logging

logger = logging.getLogger(__name__)

def cleanup_temp(path: str):
    try:
        if os.path.exists(path):
            os.unlink(path)
        parent = os.path.dirname(path)
        if os.path.exists(parent):
            shutil.rmtree(parent)
    except Exception as e:
        logger.error(f"Error cleaning up {path}: {e}")
