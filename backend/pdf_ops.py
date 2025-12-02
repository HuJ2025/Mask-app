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
import pikepdf
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


import pikepdf

# ...

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


def ocr_from_bytes(pdf_bytes: bytes, **kwargs) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as inp, \
         tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as outp:

        inp.write(pdf_bytes)
        inp.flush()
        
        # Default options
        options = {
            'optimize': 0,
            'language': 'chi_tra+eng',
            'progress_bar': False
        }
        options.update(kwargs)
        
        ocrmypdf.ocr(inp.name, outp.name, **options)
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
        words_on_page = None  # Lazy load words if needed
        
        for lit in filter(str.strip, literals):
            # 1. Try exact search first
            found_any = False
            for rect in page.search_for(lit, flags=IGNORE_CASE):
                r = fitz.Rect(rect)                       # mutable copy
                page.add_redact_annot(r, fill=(1, 1, 1))
                page_hits.append((r, lit))
                found_any = True
            
            # 2. If not found, try multi-word fallback
            # Try splitting by space, underscore, or hyphen
            delimiters = [' ', '_', '-']
            fallback_success = False
            
            for delimiter in delimiters:
                if fallback_success: break
                if delimiter not in lit: continue
                
                if words_on_page is None:
                    words_on_page = page.get_text("words")
                
                # Split literal into words
                lit_words = lit.split(delimiter)
                if len(lit_words) < 2: continue
                
                # Find all candidates for the first word
                first_word = lit_words[0]
                candidates = [w for w in words_on_page if first_word.lower() in w[4].lower()]
                
                for start_w in candidates:
                    # Try to match the sequence starting from this word
                    current_sequence = [start_w]
                    current_idx = words_on_page.index(start_w)
                    match_failed = False
                    
                    for i in range(1, len(lit_words)):
                        target_w = lit_words[i]
                        # Look ahead for the next word
                        # We expect it to be close in the list (usually next, but maybe some noise)
                        # and physically close on the page
                        found_next = False
                        
                        # Search next few words in the list
                        for offset in range(1, 5): # Look ahead up to 4 words
                            if current_idx + offset >= len(words_on_page): break
                            
                            next_w = words_on_page[current_idx + offset]
                            
                            # Check content match
                            if target_w.lower() not in next_w[4].lower():
                                continue
                                
                            # Check physical proximity
                            # Same line (Y overlap)
                            y_overlap = max(0, min(start_w[3], next_w[3]) - max(start_w[1], next_w[1]))
                            if y_overlap < (start_w[3] - start_w[1]) * 0.5: # At least 50% height overlap
                                continue
                                
                            # X proximity (next word should be to the right, not too far)
                            last_w = current_sequence[-1]
                            x_gap = next_w[0] - last_w[2]
                            if x_gap < -2 or x_gap > 50: # Allow small overlap (-2) or reasonable gap (50)
                                continue
                                
                            # Found it
                            current_sequence.append(next_w)
                            current_idx += offset
                            found_next = True
                            break
                        
                        if not found_next:
                            match_failed = True
                            break
                    
                    if not match_failed:
                        # We found the whole sequence!
                        # Merge rects
                        x0 = min(w[0] for w in current_sequence)
                        y0 = min(w[1] for w in current_sequence)
                        x1 = max(w[2] for w in current_sequence)
                        y1 = max(w[3] for w in current_sequence)
                        
                        r = fitz.Rect(x0, y0, x1, y1)
                        page.add_redact_annot(r, fill=(1, 1, 1))
                        page_hits.append((r, lit))
                        fallback_success = True # Stop trying other delimiters for this literal on this candidate (actually we should continue looking for other instances, but break the delimiter loop if we found *this* instance? No, we need to find ALL instances. 
                        # Wait, the logic above iterates candidates. If we found a sequence starting at 'start_w', we add it.
                        # We should NOT break the candidate loop.
                        # But we SHOULD break the delimiter loop if we found matches? 
                        # Actually, a literal might be split by spaces in one place and underscores in another (unlikely but possible).
                        # But usually it's one style.
                        # Let's just let it run. If we add the same redaction twice, it's fine (idempotent).
                        pass
                        
        hits[page.number] = page_hits

    _apply_redactions(doc)                       # burn-in regardless of version

    # pass 2 ─ draw hash labels
    print(f"DEBUG: Redaction Hits Summary:", flush=True)
    for p_num, p_hits in hits.items():
        if p_hits:
            print(f"  Page {p_num + 1}: {len(p_hits)} hits", flush=True)
            for r, lit in p_hits:
                print(f"    - '{lit}' at {r}", flush=True)
        else:
            print(f"  Page {p_num + 1}: No hits", flush=True)
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

def process_pdf(input_path: str, output_path: str, literals: list[str], progress_callback=None, check_cancel=None) -> None:
    """
    Orchestrates the full redaction pipeline.
    """
    def report(pct, msg):
        if check_cancel and check_cancel():
            raise Exception("Cancelled")
            
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
    
    # Check initial text length
    text_len_before = get_text_length(rotated)
    print(f"DEBUG: Text length before: {text_len_before} chars", flush=True)

    # Count literal hits before OCR
    hits_before = count_literal_hits(rotated, literals)
    print(f"DEBUG: Literal hits before OCR: {hits_before}", flush=True)
    
    # Always run OCR to check for improvements
    report(40, "Running OCR (Adaptive)...")
    
    # Monkeypatch ProgressBar
    original_progressbar = ocrmypdf._progressbar.RichProgressBar
    
    # Wrap callback to scale OCR progress (0-100) to global progress (40-70)
    def ocr_progress_wrapper(*args):
        if check_cancel and check_cancel():
            raise Exception("Cancelled")

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
        # Always try force_ocr first
        ocred = ocr_from_bytes(rotated, force_ocr=True)
        
        # Check if OCR improved text length
        text_len_after = get_text_length(ocred)
        print(f"DEBUG: Text length after: {text_len_after} chars", flush=True)
        
        # Check literal hits after OCR
        hits_after = count_literal_hits(ocred, literals)
        print(f"DEBUG: Literal hits after OCR: {hits_after}", flush=True)
        
        diff = text_len_after - text_len_before
        print(f"DEBUG: Text length improvement: {diff} chars", flush=True)
        
        # Decision Logic:
        # 1. If OCR LOST literals compared to original, REVERT (safety check).
        # 2. If OCR didn't increase text length significantly, REVERT (style preservation).
        
        revert_reason = None
        if hits_after <= hits_before:
            revert_reason = f"OCR lost/did not improve literals ({hits_after} < {hits_before})"
        elif diff < 80: # Heuristic: OCR should add at least 50 chars to be worth it
            revert_reason = f"OCR did not significantly improve text length (diff={diff})"
            
        if revert_reason:
            print(f"DEBUG: Reverting to skip_text. Reason: {revert_reason}", flush=True)
            report(60, "Reverting to original text...")
            # Re-run with skip_text to get PDF/A compliance but preserve original text/layout
            try:
                ocred = ocr_from_bytes(rotated, skip_text=True)
            except Exception as e:
                print(f"DEBUG: Revert failed: {e}")
                ocred = rotated
        else:
            print("DEBUG: OCR improved text content. Keeping OCR result.", flush=True)
            
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
        print(f"DEBUG: Error calculating text length: {e}")
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
        print(f"DEBUG: Error counting literal hits: {e}")
        return 0
