import os
import io
import tempfile
import hashlib
import pytesseract
import ocrmypdf
import fitz  # PyMuPDF
from PIL import ImageStat
from pdf2image import convert_from_bytes
from pytesseract import Output
from PyPDF2 import PdfReader, PdfWriter
import ocrmypdf._progressbar

try:
    IGNORE_CASE = fitz.TEXT_IGNORECASE       # 1.23+
except AttributeError:
    IGNORE_CASE = 1     # for older versions of PyMuPDF

class GuiProgressBar:
    callback = None
    
    def __init__(self, total=None, desc="", unit="", disable=False, **kwargs):
        self.total = total
        self.desc = desc
        self.current = 0
        
    def __enter__(self):
        return self
        
    def __exit__(self, *args):
        pass
        
    def update(self, n=1, **kwargs):
        self.current += n
        if self.callback:
            # Use -1 to indicate text-only update or partial update
            # We can try to calculate percentage if total is known
            pct = 0
            if self.total and self.total > 0:
                pct = int((self.current / self.total) * 100)
            
            msg = f"{self.desc}"
            self.callback(pct, msg)

# --- Utility functions ---
def is_blank_page(image, threshold=0.98):
    stat = ImageStat.Stat(image.convert('L'))
    return (stat.mean[0] / 255) > threshold


def correct_pdf_rotation(pdf_bytes: bytes) -> bytes:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    writer = PdfWriter()
    images = convert_from_bytes(pdf_bytes, dpi=300)
    for i, image in enumerate(images):
        if not is_blank_page(image):
            try:
                osd = pytesseract.image_to_osd(image.convert("RGB"), output_type=Output.DICT)
                angle = osd.get('rotate', 0)
            except pytesseract.TesseractError:
                angle = 0
        else:
            angle = 0

        page = reader.pages[i]
        if angle:
            page.rotate(angle)
        writer.add_page(page)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def ocr_from_bytes(pdf_bytes: bytes) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as inp, \
         tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as outp:

        inp.write(pdf_bytes)
        inp.flush()
        ocrmypdf.ocr(
            inp.name, outp.name,
            optimize=0,
            language='chi_tra+eng',
            force_ocr=True,
            progress_bar=False # We handle progress bar globally via monkeypatching if needed, or rely on wrapper
        )
        data = outp.read()

    os.unlink(inp.name)
    os.unlink(outp.name)
    return data

def _apply_redactions(doc: fitz.Document) -> None:
    """Call the right redaction-burner for this PyMuPDF version."""
    if hasattr(doc, "apply_redactions"):        # ≥ 1.19
        doc.apply_redactions()
    else:                                       # ≤ 1.18
        for page in doc:
            page.apply_redactions()

def redact_pdf_bytes_uncopyable(pdf_bytes: bytes, literals: list[str]) -> bytes:
    """
    • Physically removes every case-insensitive match in `literals`
      so text cannot be copied.
    • Covers the area in white.
    • Writes an 8-char SHA-256 hash of the removed string on top.
    • Returns the redacted PDF as bytes.
    """
    doc  = fitz.open(stream=pdf_bytes, filetype="pdf")
    hits = {}                                   # page.no → [(rect, literal)]

    # pass 1 ─ mark what to remove
    for page in doc:
        page_hits = []
        for lit in filter(str.strip, literals):
            for rect in page.search_for(lit, flags=IGNORE_CASE):
                r = fitz.Rect(rect)                       # mutable copy
                page.add_redact_annot(r, fill=(1, 1, 1))
                page_hits.append((r, lit))
        hits[page.number] = page_hits

    _apply_redactions(doc)                       # burn-in regardless of version

    # pass 2 ─ draw hash labels
    for page in doc:
        for r, lit in hits[page.number]:
            label = hashlib.sha256(lit.encode()).hexdigest()[:8]

            # make a slightly bigger box so text has room
            box  = r + (-2, -2, 2, 2)            # inflate by 2pt each side

            for fs in (10, 8, 6, 5):             # try decreasing font sizes
                n = page.insert_textbox(
                        box, label,
                        fontsize=fs,
                        fontname="helv",
                        color=(0, 0, 0),
                        align=fitz.TEXT_ALIGN_CENTER
                    )
                if n > 0:                        # text fit → done with this box
                    break
            # If none fit, you can optionally fall back to a sticky-note annot:
            # else:
            #     page.add_text_annot(r, label)

    pdf_out = doc.tobytes()
    doc.close()
    return pdf_out

def process_pdf(input_path: str, output_path: str, literals: list[str], progress_callback=None) -> None:
    """
    Orchestrates the full redaction pipeline.
    """
    def report(pct, msg):
        if progress_callback:
            progress_callback(pct, msg)
        else:
            print(f"PROGRESS {pct}: {msg}", flush=True)

    report(0, "Reading file...")
    # 1) Read
    with open(input_path, 'rb') as f:
        data = f.read()
    
    report(20, "Correcting rotation...")
    # 2) Rotate & OCR
    rotated = correct_pdf_rotation(data)
    
    report(40, "Running OCR...")
    
    # Monkeypatch ProgressBar
    original_progressbar = ocrmypdf._progressbar.RichProgressBar
    
    # Wrap callback to scale OCR progress (0-100) to global progress (40-70)
    def ocr_progress_wrapper(*args):
        if progress_callback:
            try:
                # Handle variable arguments (self, pct, msg) or (pct, msg)
                if len(args) == 2:
                    pct, msg = args
                elif len(args) == 3:
                    _, pct, msg = args
                else:
                    return

                # Scale 0-100 -> 40-70
                scaled_pct = 40 + int(pct * 0.3)
                progress_callback(scaled_pct, f"OCR: {msg}")
            except Exception as e:
                print(f"DEBUG: Error in ocr_progress_wrapper: {e}")

    GuiProgressBar.callback = ocr_progress_wrapper
    ocrmypdf._progressbar.RichProgressBar = GuiProgressBar
    
    try:
        ocred = ocr_from_bytes(rotated)
    finally:
        # Restore ProgressBar
        ocrmypdf._progressbar.RichProgressBar = original_progressbar
        GuiProgressBar.callback = None
    
    report(70, "Applying redactions...")
    # 3) Redact
    redacted = redact_pdf_bytes_uncopyable(ocred, literals)
    
    report(90, "Saving file...")
    # 4) Write
    print(f"DEBUG: Writing to {output_path}")
    try:
        with open(output_path, 'wb') as f:
            f.write(redacted)
        print(f"DEBUG: File written. Exists? {os.path.exists(output_path)}")
        print(f"DEBUG: File size: {os.path.getsize(output_path)}")
    except Exception as e:
        print(f"DEBUG: Error writing file: {e}")
        raise e
    
    report(100, "Done!")
    print(f"Redacted PDF written to {output_path}")
