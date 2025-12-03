import os
import io
import shutil
import logging
import pikepdf
import pytesseract
from PIL import ImageStat
from pdf2image import convert_from_bytes
from pytesseract import Output

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

def is_blank_page(image, threshold=0.98):
    stat = ImageStat.Stat(image.convert('L'))
    return (stat.mean[0] / 255) > threshold

def correct_pdf_rotation(pdf_bytes: bytes) -> bytes:
    # Use pikepdf instead of PyPDF2 to avoid PyCryptodome dependency issues
    pdf = pikepdf.open(io.BytesIO(pdf_bytes))
    images = convert_from_bytes(pdf_bytes, dpi=300)
    
    # We need to iterate through pages. 
    # Note: pikepdf pages are 0-indexed.
    # convert_from_bytes returns a list of images, one per page.
    
    for i, image in enumerate(images):
        if i >= len(pdf.pages):
            break
            
        if not is_blank_page(image):
            try:
                osd = pytesseract.image_to_osd(image.convert("RGB"), output_type=Output.DICT)
                angle = osd.get('rotate', 0)
            except pytesseract.TesseractError:
                angle = 0
        else:
            angle = 0

        if angle:
            # pikepdf rotation is clockwise, tesseract returns clockwise rotation needed
            # to make it upright. So we rotate by that amount.
            # However, pikepdf.Page.rotate(angle, relative=True) adds to current rotation.
            pdf.pages[i].rotate(angle, relative=True)

    out = io.BytesIO()
    pdf.save(out)
    return out.getvalue()

import fitz

def get_text_length(pdf_bytes: bytes) -> int:
    """
    Calculates the total number of characters in the document.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_len = 0
        for page in doc:
            total_len += len(page.get_text())
        return total_len
    except Exception as e:
        logger.error(f"Error calculating text length: {e}")
        return 0

def count_literal_hits(pdf_bytes: bytes, literals: list[str]) -> int:
    """
    Counts total occurrences of target literals in the PDF.
    Used to check if OCR caused data loss.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_hits = 0
        for page in doc:
            text = page.get_text()
            for lit in literals:
                total_hits += text.count(lit)
        return total_hits
    except Exception as e:
        logger.error(f"Error counting literal hits: {e}")
        return 0
