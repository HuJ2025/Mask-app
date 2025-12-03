import fitz
import hashlib

try:
    IGNORE_CASE = fitz.TEXT_IGNORECASE       # 1.23+
except AttributeError:
    IGNORE_CASE = 1     # for older versions of PyMuPDF

class Redactor:
    def __init__(self):
        pass

    def _apply_redactions(self, doc: fitz.Document) -> None:
        """Call the right redaction-burner for this PyMuPDF version."""
        if hasattr(doc, "apply_redactions"):        # ≥ 1.19
            # Enable image pixel redaction
            doc.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)
        else:                                       # ≤ 1.18
            for page in doc:
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)

    def redact(self, pdf_bytes: bytes, literals: list[str]) -> bytes:
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
                            fallback_success = True 
                            pass
                            
            hits[page.number] = page_hits

        self._apply_redactions(doc)                       # burn-in regardless of version

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
