import os
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def open_system_mail_client(recipient: str, subject: str, body: str, attachment_path: str):
    """
    Opens the macOS Mail app with a new draft containing the specified details and attachment.
    """
    try:
        attachments_script = ""
        
        # If directory, iterate and add each file
        if os.path.isdir(attachment_path):
            for root, dirs, files in os.walk(attachment_path):
                for file in files:
                    # Skip hidden files
                    if file.startswith('.'):
                        continue
                        
                    file_path = os.path.join(root, file)
                    # Notice: file name instead of file_name
                    attachments_script += f'make new attachment with properties {{file name:POSIX file "{file_path}"}} at after the last paragraph\n'
        else:
            # Single file
            attachments_script = f'make new attachment with properties {{file name:POSIX file "{attachment_path}"}} at after the last paragraph'

        # AppleScript to open Mail
        apple_script = f'''
        tell application "Mail"
            set newMessage to make new outgoing message with properties {{subject:"{subject}", content:"{body} " & return & return, visible:true}}
            tell newMessage
                make new to recipient at end of to recipients with properties {{address:"{recipient}"}}
                {attachments_script}
            end tell
            activate
        end tell
        '''

        subprocess.run(['osascript', '-e', apple_script], check=True)
        logger.info(f"Opened Mail app for {recipient}")

    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to run AppleScript: {e}")
        raise Exception("Failed to open Mail app")
    except Exception as e:
        logger.error(f"Error opening system mail: {e}")
        raise e