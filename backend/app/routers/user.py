from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from app.auth import get_current_user, CurrentUser
from app.rate_limit import limiter
from app.services import supabase_client

router = APIRouter(prefix="/api/user", tags=["user"])


@router.get("/progress")
async def progress(current_user: CurrentUser = Depends(get_current_user)):
    user_id = current_user.id
    try:
        profile = supabase_client.get_profile(user_id)
        notes_count = len(supabase_client.list_notes(user_id))
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    xp = profile.get("xp", 0)
    streak = profile.get("streak", 0)
    return {
        "xp": xp,
        "streak": streak,
        "level": xp // 100 + 1,
        "xp_to_next_level": 100 - (xp % 100),
        "notes_count": notes_count,
        "badges": supabase_client.get_badges(notes_count, streak),
    }


@router.get("/weak-topics")
async def weak_topics(current_user: CurrentUser = Depends(get_current_user)):
    try:
        topics = supabase_client.get_weak_topics(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"topics": topics}


class AnalogyDomainRequest(BaseModel):
    # Up to 3 domains, e.g. ["Football", "Cricket", "Gaming"] — many
    # students recognize more than one, so explanations mix across
    # whichever are set instead of forcing everything through just one.
    domains: list[str] = []


@router.get("/analogy-domain")
async def get_analogy_domain(current_user: CurrentUser = Depends(get_current_user)):
    """The student's "explain everything through ___" preference. Returns
    both the raw comma-joined `domain` string (what every AI prompt
    consumes) and the parsed `domains` list (what the multi-select UI
    prefills from) so neither side has to re-implement the split/join."""
    try:
        domain = supabase_client.get_analogy_domain(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    domains = [d.strip() for d in (domain or "").split(",") if d.strip()]
    return {"domain": domain, "domains": domains}


@router.post("/analogy-domain")
async def set_analogy_domain_route(req: AnalogyDomainRequest, current_user: CurrentUser = Depends(get_current_user)):
    if len(req.domains) > 3:
        raise HTTPException(400, "Pick at most 3 — NoteBuddy mixes analogies across whichever ones you choose.")
    try:
        supabase_client.set_analogy_domain(current_user.id, req.domains)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    cleaned = [d.strip() for d in req.domains if d.strip()][:3]
    return {"status": "ok", "domains": cleaned, "domain": ", ".join(cleaned) or None}


@router.get("/exam-readiness")
async def exam_readiness(current_user: CurrentUser = Depends(get_current_user)):
    """The single combined "exam-readiness %" — pure arithmetic over quiz
    accuracy and flashcard-review freshness the app already tracks, no
    extra AI call. See get_exam_readiness's docstring for the formula."""
    try:
        return supabase_client.get_exam_readiness(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.post("/reset-progress")
async def reset_progress(current_user: CurrentUser = Depends(get_current_user)):
    """Clears weak topics, logged quiz answers, and flashcard spaced-
    repetition progress — the study HISTORY that can go stale or wrong
    (e.g. old test data in a different language throwing off Study
    Coach's weak-topics list) — without touching notes, XP, streak, or
    badges. A lighter, reversible-in-spirit alternative to deleting the
    whole account just to clear out old quiz data."""
    try:
        supabase_client.reset_progress(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "reset"}


@router.delete("/account")
async def delete_account(current_user: CurrentUser = Depends(get_current_user)):
    """A real account-deletion flow, not a support-email dead end — wipes
    every row tied to this student (notes, flashcard/topic progress, push
    subscriptions, profile) and then removes the auth user itself."""
    try:
        supabase_client.delete_account(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    except Exception:
        raise HTTPException(502, "Couldn't fully delete your account right now — please try again in a moment.")
    return {"status": "deleted"}


@router.get("/class-heatmap")
async def class_heatmap(current_user: CurrentUser = Depends(get_current_user)):
    """Anonymized class-wide weak-spot heatmap — aggregate miss rates per
    topic across every student using the app, never anything about an
    individual. Auth is only to gate this to logged-in students; the data
    returned carries no identity at all."""
    try:
        return {"heatmap": supabase_client.get_class_heatmap()}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/hardest-questions")
async def hardest_questions(subject: str | None = None, current_user: CurrentUser = Depends(get_current_user)):
    """Global, anonymized "hardest questions" databank — same anonymity
    floor as /class-heatmap, aggregated across every NoteBuddy student
    (optionally scoped to one subject), with one real example question per
    topic so it reads as concrete rather than just a bar chart of terms."""
    try:
        return {"topics": supabase_client.get_global_hardest_topics(subject=subject)}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


class StudyBuddyOptInRequest(BaseModel):
    opt_in: bool
    display_name: str | None = None
    note: str | None = None


@router.get("/study-buddy/status")
async def study_buddy_status(current_user: CurrentUser = Depends(get_current_user)):
    try:
        return supabase_client.get_study_buddy_status(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.post("/study-buddy/opt-in")
async def study_buddy_opt_in(req: StudyBuddyOptInRequest, current_user: CurrentUser = Depends(get_current_user)):
    if req.opt_in and not (req.display_name and req.display_name.strip()):
        raise HTTPException(400, "Pick a display name first — this is what other students will see, never your email.")
    try:
        supabase_client.set_study_buddy_opt_in(current_user.id, req.opt_in, req.display_name, req.note)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"status": "ok"}


class FeatureUsageRequest(BaseModel):
    feature: str


@router.post("/feature-usage")
@limiter.limit("60/minute")
async def log_feature_usage_route(
    request: Request, req: FeatureUsageRequest, current_user: CurrentUser = Depends(get_current_user)
):
    """Fire-and-forget analytics ping — see the technical gap report's
    "no feature-usage analytics" gap. Deliberately returns 200 even when
    logging fails (bad/unknown feature name, Supabase hiccup): this must
    never be something the frontend has to handle as an error, since it's
    firing in the background while the student is doing something else."""
    try:
        supabase_client.log_feature_usage(current_user.id, req.feature)
    except RuntimeError:
        pass
    return {"status": "ok"}


@router.get("/feature-usage-summary")
async def feature_usage_summary(current_user: CurrentUser = Depends(get_current_user)):
    """Most/least-used features across the whole app — not scoped to this
    user, this is an aggregate. Gated to any logged-in user for now (there's
    no admin-role concept yet) since it carries no per-student identity or
    content, only counts."""
    try:
        return {"features": supabase_client.get_feature_usage_summary()}
    except RuntimeError as e:
        raise HTTPException(503, str(e))


@router.get("/study-buddy/matches")
async def study_buddy_matches(current_user: CurrentUser = Depends(get_current_user)):
    """Matches by shared note subjects with everyone else who's opted in.
    Only ever shows the display name and note THEY chose to share — never
    their email or anything else tied to their account."""
    try:
        matches = supabase_client.find_study_buddies(current_user.id)
    except RuntimeError as e:
        raise HTTPException(503, str(e))
    return {"matches": matches}
