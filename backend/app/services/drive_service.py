"""Google Drive file import — lets a student paste a "share" link to a
lecture video/audio recording, a PDF, or a scanned photo stored in their
Drive, instead of downloading it locally and re-uploading it by hand.

Uses gdown (the same well-maintained trick tools like Colab notebooks rely
on) to resolve Drive's various share-link formats and get past the
"can't scan this file for viruses" interstitial Google shows for larger
files — that interstitial's exact HTML has changed more than once over the
years, so leaning on a library that tracks those changes is far more
reliable than hand-rolling the scrape ourselves.
"""

import os
import tempfile
import gdown


class DriveImportError(Exception):
    """Raised when a Drive link can't be resolved or downloaded."""


def download_drive_file(url: str) -> tuple[bytes, str]:
    """Downloads a Google Drive file from a share link and returns its raw
    bytes plus its original filename (used to tell audio/video from
    PDF/image so the right pipeline — transcription vs OCR — picks it up).

    The file must be shared as "Anyone with the link" can view — gdown
    can't sign in as a specific Google account, so a private/restricted
    link will fail here the same way it would for any other visitor
    without access."""
    if "drive.google.com" not in url and "docs.google.com" not in url:
        raise DriveImportError("That doesn't look like a Google Drive link.")

    tmp_dir = tempfile.mkdtemp(prefix="notebuddy_drive_")
    try:
        output_path = gdown.download(url=url, output=f"{tmp_dir}/", quiet=True, fuzzy=True)
    except Exception as e:
        raise DriveImportError(
            "Couldn't download that file — make sure it's shared as \"Anyone with the link\", then try again."
        ) from e

    if not output_path or not os.path.exists(output_path):
        raise DriveImportError(
            "Couldn't download that file — make sure it's shared as \"Anyone with the link\", then try again."
        )

    filename = os.path.basename(output_path)
    try:
        with open(output_path, "rb") as f:
            raw_bytes = f.read()
    finally:
        # Best-effort cleanup — a stray temp file here is small and rare,
        # never worth failing the actual import over.
        try:
            os.remove(output_path)
            os.rmdir(tmp_dir)
        except OSError:
            pass

    return raw_bytes, filename
