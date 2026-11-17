#!/usr/bin/env python3
"""
SKE Local OCR & Document Extraction Engine
Self-hosted server-side OCR service using PyMuPDF, Poppler, OpenCV, and Tesseract.
Strictly local: Zero external APIs, zero cloud transmission.
"""

import sys
import os
import json
import time

def process_document(file_path):
    start_time = time.time()
    
    if not os.path.exists(file_path):
        return {
            "success": False,
            "error": f"File not found: {file_path}",
            "text": "",
            "numpages": 0,
            "ocrApplied": False,
            "ocrConfidence": 0,
            "method": "FAILED"
        }
    
    file_ext = os.path.splitext(file_path)[1].lower()
    is_image = file_ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"]
    
    # 1. Process Direct Images
    if is_image:
        try:
            import pytesseract
            from PIL import Image
            import cv2
            import numpy as np

            img = cv2.imread(file_path)
            if img is None:
                pil_img = Image.open(file_path)
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            denoised = cv2.GaussianBlur(gray, (3, 3), 0)
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            ocr_text = pytesseract.image_to_string(thresh, lang="eng")
            
            data = pytesseract.image_to_data(thresh, lang="eng", output_type=pytesseract.Output.DICT)
            confidences = [int(c) for c in data.get("conf", []) if int(c) > 0]
            avg_conf = round(sum(confidences) / len(confidences)) if confidences else 85

            return {
                "success": True,
                "text": ocr_text.strip(),
                "numpages": 1,
                "ocrApplied": True,
                "ocrConfidence": avg_conf,
                "ocrTextPreview": ocr_text.strip()[:300],
                "method": "LOCAL_OCR",
                "executionTimeMs": round((time.time() - start_time) * 1000)
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Local Image OCR failed: {str(e)}",
                "text": "",
                "numpages": 1,
                "ocrApplied": True,
                "ocrConfidence": 0,
                "method": "FAILED"
            }

    # 2. Process PDF Documents
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        total_pages = len(doc)
        digital_text_parts = []
        pages_needing_ocr = []

        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_text = page.get_text().strip()
            digital_text_parts.append(page_text)
            if len(page_text) < 40:
                pages_needing_ocr.append(page_idx)

        combined_digital = "\n\n".join(digital_text_parts).strip()

        if len(pages_needing_ocr) == 0 and len(combined_digital) >= 50:
            doc.close()
            return {
                "success": True,
                "text": combined_digital,
                "numpages": total_pages,
                "ocrApplied": False,
                "ocrConfidence": 100,
                "ocrTextPreview": combined_digital[:300],
                "method": "PDF_TEXT",
                "executionTimeMs": round((time.time() - start_time) * 1000)
            }

        try:
            import pytesseract
            import cv2
            import numpy as np

            final_text_parts = list(digital_text_parts)
            ocr_confidences = []

            for page_idx in pages_needing_ocr:
                page = doc[page_idx]
                zoom = 300.0 / 72.0
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat, alpha=False)

                img_array = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
                gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
                denoised = cv2.GaussianBlur(gray, (3, 3), 0)
                _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

                page_ocr_text = pytesseract.image_to_string(thresh, lang="eng")
                final_text_parts[page_idx] = page_ocr_text.strip()

                data = pytesseract.image_to_data(thresh, lang="eng", output_type=pytesseract.Output.DICT)
                confidences = [int(c) for c in data.get("conf", []) if int(c) > 0]
                if confidences:
                    ocr_confidences.extend(confidences)

            doc.close()
            full_text = "\n\n".join(final_text_parts).strip()
            avg_conf = round(sum(ocr_confidences) / len(ocr_confidences)) if ocr_confidences else 85

            return {
                "success": True,
                "text": full_text,
                "numpages": total_pages,
                "ocrApplied": True,
                "ocrConfidence": avg_conf,
                "ocrTextPreview": full_text[:300],
                "method": "LOCAL_OCR",
                "executionTimeMs": round((time.time() - start_time) * 1000)
            }
        except Exception as ocr_err:
            doc.close()
            if len(combined_digital) > 0:
                return {
                    "success": True,
                    "text": combined_digital,
                    "numpages": total_pages,
                    "ocrApplied": False,
                    "ocrConfidence": 70,
                    "ocrTextPreview": combined_digital[:300],
                    "method": "PDF_TEXT",
                    "executionTimeMs": round((time.time() - start_time) * 1000)
                }
            raise ocr_err

    except ImportError:
        return {
            "success": False,
            "error": "PyMuPDF (fitz) or Tesseract not installed in python environment. Fallback to Node WASM OCR engine.",
            "fallbackToNode": True
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"PDF extraction error: {str(e)}",
            "fallbackToNode": True
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: ocr_engine.py <file_path>"}))
        sys.exit(1)

    input_file = sys.argv[1]
    result = process_document(input_file)
    print(json.dumps(result))
