"""Pulls a transcript from a YouTube lecture URL using the free, unofficial
youtube-transcript-api — no video download, no audio transcription, no
extra Gemini/AI spend. It reads whatever captions (auto-generated or
manual) YouTube already has for the video.

IMPORTANT — this only works reliably when the *server* making the request
isn't on an IP YouTube has blocked. Since mid-2024, YouTube has been
aggressively blocking the datacenter IP ranges used by Render, Heroku,
AWS, GCP, Azure, etc. for this exact scraping endpoint — completely
unrelated to whether the video actually has captions. Older versions of
this library (<1.0) couldn't tell the two apart and raised the same
"transcripts disabled" error either way, which is why a video that
obviously has captions (a GateSmashers lecture, say) could still fail
with a misleading "the owner has disabled captions" message. v1.x adds
IpBlocked / RequestBlocked so we can at least tell the student the truth.

There is no code-only fix for the IP block itself — the real fix is
routing these requests through a paid residential/rotating proxy (the
library supports one via `proxy_config`; see YOUTUBE_PROXY_URL below).
Without a proxy, this feature will work when run locally (home/mobile
IPs aren't blocked) but may fail intermittently or entirely once
deployed on Render/Vercel-style hosting — that's a YouTube-side
limitation, not a bug in this app.
"""

import os
import re

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api import (
    IpBlocked,
    NoTranscriptFound,
    RequestBlocked,
    TranscriptsDisabled,
    VideoUnavailable,
)

# Optional: set YOUTUBE_PROXY_URL (e.g. "http://user:pass@proxy-host:port")
# to route transcript requests through a proxy — the only real fix for the
# IP-blocking issue described above. Left unset, this is a no-op.
_PROXY_URL = os.environ.get("YOUTUBE_PROXY_URL", "").strip()


def _build_api() -> YouTubeTranscriptApi:
    if not _PROXY_URL:
        return YouTubeTranscriptApi()
    from youtube_transcript_api.proxies import GenericProxyConfig

    return YouTubeTranscriptApi(
        proxy_config=GenericProxyConfig(http_url=_PROXY_URL, https_url=_PROXY_URL)
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
    api = _build_api()
    try:
        transcript_list = api.list(video_id)
        # Prefer a manually-created transcript in any language; fall back to
        # an auto-generated one (list() already sorts by quality).
        try:
            transcript = transcript_list.find_manually_created_transcript(
                [t.language_code for t in transcript_list]
            )
        except Exception:
            transcript = next(iter(transcript_list))
        fetched = transcript.fetch()
    except (IpBlocked, RequestBlocked):
        # This is the common case on Render/Vercel-style hosting — YouTube is
        # blocking the *server's* IP, not this specific video. Say so
        # honestly instead of the misleading "owner disabled captions".
        raise YouTubeImportError(
            "YouTube is currently blocking transcript requests from our server's hosting "
            "provider (this happens to most free-tier hosts, not just NoteBuddy) — it isn't "
            "about this specific video. Paste the text manually instead, or try again later."
        )
    except TranscriptsDisabled:
        raise YouTubeImportError("This video's owner has disabled captions/transcripts.")
    except NoTranscriptFound:
        raise YouTubeImportError("No transcript is available for this video.")
    except VideoUnavailable:
        raise YouTubeImportError("Couldn't find that video — check the link.")
    except Exception as e:
        raise YouTubeImportError(f"Couldn't fetch a transcript for that video: {e}")

    text = " ".join(snippet.text.strip() for snippet in fetched if snippet.text.strip())
    if not text:
        raise YouTubeImportError("That video's transcript came back empty.")
    return {"text": text, "video_id": video_id}
