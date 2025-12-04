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

        import platform
        if platform.system() != 'Darwin':
            logger.warning("System email client opening is only supported on macOS")
            # Fallback or error? For now, just return or raise to avoid crash
            # Could try simple mailto for Windows but without attachments
            # subprocess.run(['start', f'mailto:{recipient}?subject={subject}&body={body}'], shell=True)
            raise NotImplementedError("Email client integration is currently macOS only")

        subprocess.run(['osascript', '-e', apple_script], check=True)
        logger.info(f"Opened Mail app for {recipient}")

    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to run AppleScript: {e}")
        raise Exception("Failed to open Mail app")
    except Exception as e:
        logger.error(f"Error opening system mail: {e}")
        raise e

def send_email_smtp(
    recipient: str, 
    subject: str, 
    body: str, 
    attachment_path: str,
    smtp_server: str,
    smtp_port: int,
    sender_email: str,
    sender_password: str
):
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = recipient
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'plain'))

    files_to_attach = []
    if os.path.isdir(attachment_path):
        for root, dirs, files in os.walk(attachment_path):
            for file in files:
                if not file.startswith('.'):
                    files_to_attach.append(os.path.join(root, file))
    else:
        files_to_attach.append(attachment_path)

    for file_path in files_to_attach:
        try:
            with open(file_path, "rb") as attachment:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment.read())
            
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {os.path.basename(file_path)}",
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file {file_path}: {e}")

    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, recipient, text)
        server.quit()
        logger.info(f"Email sent successfully to {recipient}")
    except Exception as e:
        logger.error(f"SMTP error: {e}")
        raise e