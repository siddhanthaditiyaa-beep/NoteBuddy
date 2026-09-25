"""Pulls a transcript from a YouTube lecture URL using the free, unofficial
youtube-transcript-api — no video download, no audio transcription, no
extra Gemini/AI spend. It reads whatever captions (auto-generated or
manual) YouTube already has for the video."""

import re
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
)


class YouTubeImportError(Exception):
    """Raised when a transcript can't be fetched — routers turn this into a
    friendly 4xx instead of a raw traceback."""


_ID_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtube\.com/embed/|youtu\.be/|youtube\.com/shorts/)([\w-]{11})"),
]


def extract_video_id(url: str) -> str:
    url = (url or "").strip()
    for pattern in _ID_PATTERNS:
        match = pattern.search(url)
        if match:
            return match.group(1)
    # Bare 11-character video ID pasted directly
    if re.fullmatch(r"[\w-]{11}", url):
        return url
    raise YouTubeImportError("That doesn't look like a valid YouTube link.")


def get_transcript_text(url: str) -> dict:
    video_id = extract_video_id(url)
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        # Prefer a manually-created transcript in any language; fall back to
        # an auto-generated one; fall back to English if neither is found
        # directly (list_transcripts already sorts by quality).
        try:
            transcript = transcript_list.find_manually_created_transcript(
                [t.language_code for t in transcript_list]
            )
        except Exception:
            transcript = next(iter(transcript_list))
        entries = transcript.fetch()
    except TranscriptsDisabled:
        raise YouTubeImportError("This video's owner has disabled captions/transcripts.")
    except NoTranscriptFound:
        raise YouTubeImportError("No transcript is available for this video.")
    except VideoUnavailable:
        raise YouTubeImportError("Couldn't find that video — check the link.")
    except Exception as e:
        raise YouTubeImportError(f"Couldn't fetch a transcript for that video: {e}")

    text = " ".join(entry["text"].strip() for entry in entries if entry.get("text", "").strip())
    if not text:
        raise YouTubeImportError("That video's transcript came back empty.")
    return {"text": text, "video_id": video_id}
