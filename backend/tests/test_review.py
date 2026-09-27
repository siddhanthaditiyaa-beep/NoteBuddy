"""Tests for the spaced-repetition review system (backend/app/routers/review.py,
backend/app/services/supabase_client.py's SM-2 implementation).

Two layers, per the technical gap report:
  - Unit tests hit grade_flashcard() directly with a mocked Supabase client,
    to pin down the actual SM-2 math with no network involved.
  - Integration tests go through the real FastAPI app + TestClient, with
    only the Supabase-touching functions mocked, to confirm the routes wire
    requests/responses together correctly (status codes, validation, the
    exact JSON shape the frontend depends on).
"""
from unittest.mock import patch, MagicMock

from app.services import supabase_client


def _execute_result(data):
    """Mimics the shape of a supabase-py response: an object with a .data
    attribute, which is what grade_flashcard()'s `existing.data` reads."""
    result = MagicMock()
    result.data = data
    return result


# ---------------------------------------------------------------------------
# Unit tests: SM-2 math (grade_flashcard), no HTTP layer involved
# ---------------------------------------------------------------------------
class TestSM2Grading:
    @patch("app.services.supabase_client.get_client")
    def test_new_card_graded_good_gets_one_day_interval(self, mock_get_client):
        """First-ever review of a card, quality=4 (Good): SM-2 says a first
        successful repetition always gets a 1-day interval, regardless of
        the ease factor."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = _execute_result(None)

        result = supabase_client.grade_flashcard(
            user_id="u1", note_id="n1", card_index=0, quality=4
        )

        assert result["interval_days"] == 1

    @patch("app.services.supabase_client.get_client")
    def test_second_success_gets_six_day_interval(self, mock_get_client):
        """SM-2's second successful repetition is hardcoded to 6 days,
        independent of ease — only the third-and-later reviews multiply by
        the ease factor."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        existing_row = {"ease_factor": 2.5, "interval_days": 1, "repetitions": 1}
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = _execute_result(existing_row)

        result = supabase_client.grade_flashcard(
            user_id="u1", note_id="n1", card_index=0, quality=5
        )

        assert result["interval_days"] == 6

    @patch("app.services.supabase_client.get_client")
    def test_forgetting_resets_repetitions_and_interval(self, mock_get_client):
        """quality < 3 ("Again"/forgot) must reset the schedule to square
        one even for a card with a long-established interval — otherwise a
        card the student has genuinely forgotten would keep drifting
        further out instead of coming back for review soon."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        existing_row = {"ease_factor": 2.8, "interval_days": 30, "repetitions": 5}
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = _execute_result(existing_row)

        result = supabase_client.grade_flashcard(
            user_id="u1", note_id="n1", card_index=0, quality=0
        )

        assert result["interval_days"] == 1

    @patch("app.services.supabase_client.get_client")
    def test_ease_factor_never_drops_below_1_3(self, mock_get_client):
        """SM-2 floors the ease factor at 1.3 so a run of bad grades can't
        push it into negative/degenerate territory — repeatedly grading
        quality=0 against an already-low ease factor must still floor out,
        not keep falling."""
        mock_client = MagicMock()
        mock_get_client.return_value = mock_client
        existing_row = {"ease_factor": 1.3, "interval_days": 1, "repetitions": 0}
        mock_client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value = _execute_result(existing_row)

        supabase_client.grade_flashcard(user_id="u1", note_id="n1", card_index=0, quality=0)

        upsert_payload = mock_client.table.return_value.upsert.call_args[0][0]
        assert upsert_payload["ease_factor"] >= 1.3


# ---------------------------------------------------------------------------
# Integration tests: real FastAPI routes via TestClient, Supabase mocked
# ---------------------------------------------------------------------------
class TestReviewRoutes:
    def test_due_cards_empty_when_none_due(self, client):
        with patch("app.services.supabase_client.get_due_flashcards", return_value=[]):
            res = client.get("/api/review/due")
        assert res.status_code == 200
        assert res.json() == {"cards": [], "count": 0}

    def test_due_cards_requires_auth(self):
        """No dependency override here — a request with no Authorization
        header at all must be rejected before it ever reaches Supabase."""
        from app.main import app
        from fastapi.testclient import TestClient

        with TestClient(app) as anon_client:
            res = anon_client.get("/api/review/due")
        assert res.status_code == 401

    def test_grade_rejects_out_of_range_quality(self, client):
        res = client.post(
            "/api/review/grade",
            json={"note_id": "n1", "card_index": 0, "quality": 9},
        )
        assert res.status_code == 400

    def test_grade_accepts_valid_quality(self, client):
        with patch(
            "app.services.supabase_client.grade_flashcard",
            return_value={"next_review_date": "2026-01-01T00:00:00+00:00", "interval_days": 1},
        ) as mock_grade:
            res = client.post(
                "/api/review/grade",
                json={"note_id": "n1", "card_index": 0, "quality": 4},
            )
        assert res.status_code == 200
        assert res.json()["interval_days"] == 1
        mock_grade.assert_called_once()

    def test_quiz_answer_logs_even_if_one_write_fails(self, client):
        """record_quiz_answer (weak-topics) and log_quiz_answer (history)
        are two independent best-effort writes — one failing must not take
        the other down with it, since the response the student sees should
        never depend on either succeeding."""
        with patch(
            "app.services.supabase_client.record_quiz_answer",
            side_effect=RuntimeError("Supabase not configured"),
        ), patch("app.services.supabase_client.log_quiz_answer") as mock_log:
            res = client.post(
                "/api/review/quiz-answer",
                json={"topic": "Mitochondria", "correct": True},
            )
        assert res.status_code == 200
        assert res.json() == {"status": "ok"}
        mock_log.assert_called_once()
