
import os
import json
import shutil
from pathlib import Path
from config import Config, DEFAULT_CONFIG

# Mock config file location for testing
TEST_CONFIG_FILE = Path("test_config.json")

def test_config_email_settings():
    print("Testing Email Configuration...")
    
    # Backup original config if exists (though we use a different file path in test if we could mock it, 
    # but Config class uses hardcoded path. For this test, we will just instantiate Config and check defaults,
    # then manually check saving if we can monkeypatch or just rely on unit test logic)
    
    # Since Config uses a hardcoded path, we should be careful. 
    # Let's just test the Config class logic by temporarily modifying the CONFIG_FILE path in the module if possible,
    # or just test the dictionary manipulation logic if we can't easily isolate file I/O.
    
    # Actually, we can just verify the DEFAULT_CONFIG structure first.
    print(f"Checking DEFAULT_CONFIG structure...")
    assert "email_settings" in DEFAULT_CONFIG
    assert "smtp_server" in DEFAULT_CONFIG["email_settings"]
    print("DEFAULT_CONFIG structure is correct.")

    # Now let's try to use the Config class. 
    # WARNING: This will read/write to the actual user config file (~/.pdfmask).
    # To avoid messing up user config, we should try to mock the file path.
    
    import config
    original_config_file = config.CONFIG_FILE
    config.CONFIG_FILE = TEST_CONFIG_FILE
    
    try:
        if TEST_CONFIG_FILE.exists():
            os.remove(TEST_CONFIG_FILE)
            
        cfg = Config()
        
        # Test 1: Default values
        print("Test 1: Default values")
        settings = cfg.get_email_settings()
        assert settings["smtp_server"] == ""
        assert settings["smtp_port"] == 587
        print("Passed.")
        
        # Test 2: Update settings
        print("Test 2: Update settings")
        new_settings = {
            "smtp_server": "smtp.test.com",
            "smtp_port": 465,
            "sender_email": "test@test.com",
            "sender_password": "password",
            "default_recipient": "recipient@test.com"
        }
        cfg.set_email_settings(new_settings)
        
        # Verify in memory
        assert cfg.get_email_settings() == new_settings
        
        # Verify on disk
        with open(TEST_CONFIG_FILE, "r") as f:
            saved_data = json.load(f)
            assert saved_data["email_settings"] == new_settings
        print("Passed.")
        
    finally:
        # Cleanup
        if TEST_CONFIG_FILE.exists():
            os.remove(TEST_CONFIG_FILE)
        config.CONFIG_FILE = original_config_file
        print("Cleanup complete.")

if __name__ == "__main__":
    test_config_email_settings()
