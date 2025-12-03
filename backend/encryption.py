import pikepdf

def repair_pdf(input_path: str) -> bool:
    """
    Attempts to repair a damaged PDF file.
    Overwrites the input file if successful.
    Returns True if repair succeeded, False otherwise.
    """
    try:
        # Open and automatically repair damaged PDF
        # allow_overwriting_input=True allows saving to the same file
        with pikepdf.open(input_path, allow_overwriting_input=True) as pdf:
            pdf.save(input_path, fix_metadata_version=True)
        print(f"Repair successful: {input_path}")
        return True
    except Exception as e:
        print(f"Repair failed for {input_path}: {e}")
        return False

def check_encryption(input_path: str) -> bool:
    """
    Checks if the PDF at input_path requires a password to open.
    Returns True if encrypted (password required), False otherwise.
    If the PDF is damaged, attempts to repair it once.
    """
    try:
        # Try to open without a password
        with pikepdf.open(input_path) as pdf:
            pass
        return False
    except pikepdf.PasswordError:
        return True
    except pikepdf.PdfError:
        # Attempt to repair the PDF
        print(f"PDF error detected, attempting repair: {input_path}")
        if repair_pdf(input_path):
            # Retry check after repair
            try:
                with pikepdf.open(input_path) as pdf:
                    pass
                return False
            except pikepdf.PasswordError:
                return True
            except Exception as e:
                print(f"Error checking encryption after repair: {e}")
                return False
        else:
            return False
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

def verify_password(input_path: str, password: str) -> bool:
    """
    Verifies if a password is correct for the given PDF.
    Returns True if correct, False otherwise.
    """
    try:
        with pikepdf.open(input_path, password=password) as pdf:
            pass
        return True
    except:
        return False
