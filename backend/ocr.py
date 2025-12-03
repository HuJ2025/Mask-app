import os
import tempfile
import ocrmypdf
import fitz

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

class OCRProcessor:
    def __init__(self, language='chi_tra+eng', optimize=0):
        self.language = language
        self.optimize = optimize

    def process(self, pdf_bytes: bytes, **kwargs) -> bytes:
        """
        Runs OCR on the provided PDF bytes.
        """
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as inp, \
             tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as outp:

            inp.write(pdf_bytes)
            inp.flush()
            
            # Default options
            options = {
                'optimize': self.optimize,
                'language': self.language,
                'progress_bar': False
            }
            options.update(kwargs)
            
            ocrmypdf.ocr(inp.name, outp.name, **options)
            data = outp.read()

        os.unlink(inp.name)
        os.unlink(outp.name)
        return data
