import pikepdf

def check_encryption(input_path: str) -> bool:
    """
    Checks if the PDF at input_path requires a password to open.
    Returns True if encrypted (password required), False otherwise.
    """
    try:
        # Try to open without a password
        with pikepdf.open(input_path) as pdf:
            pass
        return False
    except pikepdf.PasswordError:
        return True
    except Exception as e:
        print(f"Error checking encryption: {e}")
        return False

def decrypt_pdf(input_path: str, output_path: str, password: str) -> bool:
    """
    Attempts to decrypt the PDF at input_path using the provided password.
    Saves the decrypted file to output_path.
    Returns True if successful, False otherwise.
    """
    try:
        with pikepdf.open(input_path, password=password) as pdf:
            # Save without encryption
            pdf.save(output_path, encryption=pikepdf.Encryption(user="", owner=""))
        return True
    except Exception as e:
        print(f"Decryption failed: {e}")
        return False
