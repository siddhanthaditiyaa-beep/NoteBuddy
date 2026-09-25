"""Web Push — reminds a student when they have flashcards due, using the
browser-native Push API. No email service, no per-send cost, and it works
even when NoteBuddy's tab isn't open, which is the whole point: spaced
repetition only works if the student actually comes back on schedule.
"""

import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from pywebpush import webpush, WebPushException

from app.auth import get_current_user, CurrentUser
from app.config import VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_CLAIM_EMAIL, PUSH_CRON_SECRET
from app.services import supabase_client

router = APIRouter(prefix="/api/push", tags=["push"])
log = logging.getLogger("notebuddy.push")


@router.get("/vapid-public-key")
async def vapid_public_key():
    return {"key": VAPID_PUBLIC_KEY}


class SubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # {"p256dh": "...", "auth": "..."}


@router.post("/subscribe")
async def subscribe(req: SubscribeRequest, current_user: CurrentUser = Depends(get_current_user)):
    p256dh = req.keys.get("p256dh")
    auth = req.keys.get("auth")
    if not p256dh or not auth:
        raise HTTPException(400, "Invalid subscription — missing encryption keys.")
    try:
        supabase_client.save_push_subscription(current_user.id, req.endpoint, p256dh, auth)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "subscribed"}


class UnsubscribeRequest(BaseModel):
    endpoint: str


@router.post("/unsubscribe")
async def unsubscribe(req: UnsubscribeRequest, current_user: CurrentUser = Depends(get_current_user)):
    try:
        supabase_client.delete_push_subscription(req.endpoint)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "unsubscribed"}


@router.post("/send-due-reminders")
async def send_due_reminders(x_cron_secret: str | None = Header(None, alias="X-Cron-Secret")):
    """Fired once a day by a GitHub Actions cron (see
    .github/workflows/due-reminders.yml) — never by a logged-in user, so it
    checks a shared secret instead of a session token. Sends one push per
    subscribed student who actually has cards due today, and quietly drops
    any subscription the browser has since revoked."""
    if not PUSH_CRON_SECRET or x_cron_secret != PUSH_CRON_SECRET:
        raise HTTPException(403, "Not authorized.")
    if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        raise HTTPException(503, "Push notifications aren't configured (missing VAPID keys).")

    try:
        subs = supabase_client.list_push_subscriptions()
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    sent = 0
    for sub in subs:
        try:
            due = supabase_client.get_due_flashcards(sub["user_id"])
        except RuntimeError:
            continue
        if not due:
            continue

        payload = json.dumps({
            "title": "NoteBuddy — flashcards due 🧠",
            "body": f"You have {len(due)} flashcard{'s' if len(due) != 1 else ''} due for review today.",
            "url": "/review",
        })
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
                },
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": f"mailto:{VAPID_CLAIM_EMAIL}"},
            )
            sent += 1
        except WebPushException as e:
            log.warning("Push failed for a subscription, removing it: %s", e)
            try:
                supabase_client.delete_push_subscription(sub["endpoint"])
            except RuntimeError:
                pass

    return {"sent": sent, "checked": len(subs)}
