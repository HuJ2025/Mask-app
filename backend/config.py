import os
import json
import logging
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

import platform

def get_app_paths():
    system = platform.system()
    home = Path.home()
    
    if system == 'Windows':
        # Config: %APPDATA%/PDFMask/config.json
        app_data = Path(os.environ.get('APPDATA', home))
        config_dir = app_data / "PDFMask"
        config_file = config_dir / "config.json"
        
        # Save Path: ~/Documents/PDFMask
        save_path = home / "Documents" / "PDFMask"
    elif system == 'Darwin':
        # Config: ~/Library/Application Support/PDFMask/config.json
        config_dir = home / "Library" / "Application Support" / "PDFMask"
        config_file = config_dir / "config.json"
        
        # Save Path: ~/PDFMask (Keep existing behavior for Mac, or move to Documents?)
        # Let's keep ~/PDFMask for Mac to avoid changing user's expected location unexpectedly,
        # or we could standardize on Documents. Let's stick to the user's current pattern for Mac
        # but maybe Documents is cleaner? The user asked for "multi-platform support", 
        # so let's use Documents for Windows but keep Mac as is to minimize disruption, 
        # OR just use Documents for both which is cleaner.
        # Let's use ~/PDFMask for Mac as per original code, to be safe.
        save_path = home / "PDFMask"
    else:
        # Linux/Other
        config_dir = home / ".config" / "pdfmask"
        config_file = config_dir / "config.json"
        save_path = home / "PDFMask"
        
    return config_file, save_path

CONFIG_FILE, DEFAULT_SAVE_PATH = get_app_paths()

# Ensure config directory exists
try:
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.error(f"Failed to create config directory: {e}")

DEFAULT_CONFIG = {
    "words": [],
    "passwords": [],
    "email_settings": {
        "smtp_server": "",
        "smtp_port": 587,
        "sender_email": "",
        "sender_password": "",
        "default_recipient": ""
    },
    "general_settings": {
        "save_path": str(DEFAULT_SAVE_PATH)
    }
}

class Config:
    def __init__(self):
        self._config = self._load_config()

    def _load_config(self) -> Dict:
        if not CONFIG_FILE.exists():
            self._save_config(DEFAULT_CONFIG)
            return DEFAULT_CONFIG.copy()
        
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                config = json.load(f)
                # Ensure all keys exist
                for key, value in DEFAULT_CONFIG.items():
                    if key not in config:
                        config[key] = value
                
                # Ensure nested settings have all keys
                for section in ["email_settings", "general_settings"]:
                    if section in config:
                        for k, v in DEFAULT_CONFIG[section].items():
                            if k not in config[section]:
                                config[section][k] = v

                # Enforce default save_path if empty
                if not config["general_settings"].get("save_path"):
                    config["general_settings"]["save_path"] = DEFAULT_CONFIG["general_settings"]["save_path"]
                
                return config
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return DEFAULT_CONFIG.copy()

    def _save_config(self, config: Dict):
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving config: {e}")

    def get_words(self) -> List[str]:
        return self._config.get("words", [])

    def set_words(self, words: List[str]):
        self._config["words"] = words
        self._save_config(self._config)

    def get_passwords(self) -> List[str]:
        return self._config.get("passwords", [])

    def set_passwords(self, passwords: List[str]):
        self._config["passwords"] = passwords
        self._save_config(self._config)

    def get_email_settings(self) -> Dict:
        return self._config.get("email_settings", DEFAULT_CONFIG["email_settings"])

    def set_email_settings(self, settings: Dict):
        self._config["email_settings"] = settings
        self._save_config(self._config)

    def get_general_settings(self) -> Dict:
        settings = self._config.get("general_settings", DEFAULT_CONFIG["general_settings"])
        if not settings.get("save_path"):
             settings["save_path"] = DEFAULT_CONFIG["general_settings"]["save_path"]
        return settings

    def set_general_settings(self, settings: Dict):
        if not settings.get("save_path"):
            settings["save_path"] = DEFAULT_CONFIG["general_settings"]["save_path"]
        self._config["general_settings"] = settings
        self._save_config(self._config)

    def get_all(self) -> Dict:
        # Ensure save_path is populated in the returned full config
        if not self._config["general_settings"].get("save_path"):
             self._config["general_settings"]["save_path"] = DEFAULT_CONFIG["general_settings"]["save_path"]
        return self._config
