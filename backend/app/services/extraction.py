"""Turns raw uploads (plain text, PDF, or an image of handwritten/printed notes)
into a single plain-text string that the AI layer can work with."""

import io
from pypdf import PdfReader
from PIL import Image
import pytesseract


def extract_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n".join(pages).strip()


def extract_from_image(file_bytes: bytes) -> str:
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
