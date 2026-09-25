"""Turns raw uploads (plain text, PDF, or an image of handwritten/printed notes)
into a single plain-text string that the AI layer can work with."""

import io
import numpy as np
from pypdf import PdfReader
from PIL import Image
import pytesseract

try:
    import cv2
    _CV2_AVAILABLE = True
except ImportError:
    _CV2_AVAILABLE = False


def extract_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def _deskew(gray: "np.ndarray") -> "np.ndarray":
    """Straightens a photographed page that was shot at a slight angle —
    Tesseract's accuracy drops fast once text isn't roughly horizontal.
    Finds the dominant text-block angle via the minimum-area bounding box
    of all "ink" pixels and rotates to correct it."""
    inverted = cv2.bitwise_not(gray)
    coords = np.column_stack(np.where(inverted > 0))
    if coords.shape[0] < 50:  # too little content to get a reliable angle
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    # cv2.minAreaRect returns an angle in (-90, 0]; normalize to a small
    # rotation rather than accidentally flipping the page 90 degrees.
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle
    if abs(angle) < 0.5 or abs(angle) > 20:
        return gray  # not worth rotating, or too extreme to trust
    (h, w) = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    return cv2.warpAffine(gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def preprocess_for_ocr(file_bytes: bytes) -> bytes:
    """Deskew + contrast boost (CLAHE) + adaptive thresholding before OCR —
    dramatically improves Tesseract's read on angled or poorly-lit phone
    photos of handwritten/printed pages, without needing a paid vision API.
    Falls back to the original bytes untouched if OpenCV isn't installed or
    anything goes wrong, so a bad photo never hard-fails the upload."""
    if not _CV2_AVAILABLE:
        return file_bytes
    try:
        arr = np.frombuffer(file_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            return file_bytes
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = _deskew(gray)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        thresh = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
        )
        ok, encoded = cv2.imencode(".png", thresh)
        if not ok:
            return file_bytes
        return encoded.tobytes()
    except Exception:
        return file_bytes  # never let a preprocessing bug block the upload


def extract_from_image(file_bytes: bytes) -> str:
    processed = preprocess_for_ocr(file_bytes)
    image = Image.open(io.BytesIO(processed))
    text = pytesseract.image_to_string(image)
    if len(text.strip()) < 10 and processed != file_bytes:
        # Preprocessing occasionally hurts a genuinely clean, high-res scan
        # (over-thresholding can erase faint text) — if it produced next to
        # nothing, retry once on the untouched original before giving up.
        image = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(image)
    return text.strip()


def extract_text(filename: str, file_bytes: bytes) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return extract_from_pdf(file_bytes)
    if lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".bmp")):
        return extract_from_image(file_bytes)
    # fall back to treating it as plain text
    return file_bytes.decode("utf-8", errors="ignore").strip()
