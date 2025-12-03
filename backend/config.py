import os
import json
import logging
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

CONFIG_FILE = Path.home() / ".pdfmask"

DEFAULT_CONFIG = {
    "words": [],
    "passwords": []
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

    def get_all(self) -> Dict:
        return self._config
