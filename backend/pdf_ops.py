import os
import ocrmypdf
import ocrmypdf._progressbar

from ocr import GuiProgressBar, OCRProcessor
from redaction import Redactor
from utils import correct_pdf_rotation, get_text_length, count_literal_hits

class PDFRedactionPipeline:
    def __init__(self, input_path: str, output_path: str, literals: list[str], progress_callback=None, check_cancel=None):
        self.input_path = input_path
        self.output_path = output_path
        self.literals = literals
        self.progress_callback = progress_callback
        self.check_cancel = check_cancel
        self.pdf_bytes = None
        
        # Initialize processors
        self.ocr_processor = OCRProcessor()
        self.redactor = Redactor()

    def report(self, pct, msg):
        if self.check_cancel and self.check_cancel():
            raise Exception("Cancelled")
            
        if self.progress_callback:
            self.progress_callback(pct, msg)
        else:
            print(f"PROGRESS {pct}: {msg}", flush=True)

    def run(self):
        self.report(0, "Reading file...")
        self._step_load()
        
        self.report(20, "Correcting rotation...")
        self._step_rotate()
        
        # OCR step handles its own reporting (40-60%)
        self._step_ocr()
        
        self.report(70, "Applying redactions...")
        self._step_redact()
        
        self.report(90, "Saving file...")
        self._step_save()
        
        self.report(100, "Done!")
        print(f"Redacted PDF written to {self.output_path}")

    def _step_load(self):
        with open(self.input_path, 'rb') as f:
            self.pdf_bytes = f.read()

    def _step_rotate(self):
        self.pdf_bytes = correct_pdf_rotation(self.pdf_bytes)

    def _step_ocr(self):
        # Check initial text length
        text_len_before = get_text_length(self.pdf_bytes)
        print(f"DEBUG: Text length before: {text_len_before} chars", flush=True)

        # Count literal hits before OCR
        hits_before = count_literal_hits(self.pdf_bytes, self.literals)
        print(f"DEBUG: Literal hits before OCR: {hits_before}", flush=True)
        
        # Always run OCR to check for improvements
        self.report(40, "Running OCR (Adaptive)...")
        
        # Monkeypatch ProgressBar
        original_progressbar = ocrmypdf._progressbar.RichProgressBar
        
        # Wrap callback to scale OCR progress (0-100) to global progress (40-70)
        def ocr_progress_wrapper(*args):
            if self.check_cancel and self.check_cancel():
                raise Exception("Cancelled")

            if self.progress_callback:
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
                    self.progress_callback(scaled_pct, f"OCR: {msg}")
                except Exception as e:
                    print(f"DEBUG: Error in ocr_progress_wrapper: {e}")

        GuiProgressBar.callback = ocr_progress_wrapper
        ocrmypdf._progressbar.RichProgressBar = GuiProgressBar
        
        try:
            # Always try force_ocr first
            ocred = self.ocr_processor.process(self.pdf_bytes, force_ocr=True)
            
            # Check if OCR improved text length
            text_len_after = get_text_length(ocred)
            print(f"DEBUG: Text length after: {text_len_after} chars", flush=True)
            
            # Check literal hits after OCR
            hits_after = count_literal_hits(ocred, self.literals)
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
                self.report(60, "Reverting to original text...")
                # Re-run with skip_text to get PDF/A compliance but preserve original text/layout
                try:
                    self.pdf_bytes = self.ocr_processor.process(self.pdf_bytes, skip_text=True)
                except Exception as e:
                    print(f"DEBUG: Revert failed: {e}")
                    # self.pdf_bytes remains as rotated
            else:
                print("DEBUG: OCR improved text content. Keeping OCR result.", flush=True)
                self.pdf_bytes = ocred
                
        finally:
            # Restore ProgressBar
            ocrmypdf._progressbar.RichProgressBar = original_progressbar
            GuiProgressBar.callback = None

    def _step_redact(self):
        self.pdf_bytes = self.redactor.redact(self.pdf_bytes, self.literals)

    def _step_save(self):
        print(f"DEBUG: Writing to {self.output_path}")
        try:
            with open(self.output_path, 'wb') as f:
                f.write(self.pdf_bytes)
            print(f"DEBUG: File written. Exists? {os.path.exists(self.output_path)}")
            print(f"DEBUG: File size: {os.path.getsize(self.output_path)}")
        except Exception as e:
            print(f"DEBUG: Error writing file: {e}")
            raise e

def process_pdf(input_path: str, output_path: str, literals: list[str], progress_callback=None, check_cancel=None) -> None:
    """
    Orchestrates the full redaction pipeline.
    """
    pipeline = PDFRedactionPipeline(input_path, output_path, literals, progress_callback, check_cancel)
    pipeline.run()
