"""Tests for the second-pass fact-checking feature added to close gap #1
from the technical gap report (entity mix-ups like "King Louis Bonaparte").

gemini_service.verify_study_kit_facts() is the raw Gemini call;
notes.py's _verify_facts() is the wrapper that makes it non-fatal — a
verification hiccup (rate limit, malformed JSON, etc.) must degrade to
"badge just doesn't show" and never turn into a 502 for the student.
"""
from unittest.mock import patch

from app.services.gemini_service import AIGenerationError
from app.routers.notes import _verify_facts


class TestVerifyFactsWrapper:
    def test_clean_result_is_reported_as_ran_and_clean(self):
        with patch(
            "app.routers.notes.verify_study_kit_facts",
            return_value={"clean": True, "issues": []},
        ):
            result = _verify_facts("source text", {"summary": "a clean summary", "key_terms": []})
        assert result == {"ran": True, "clean": True, "issues": []}

    def test_flagged_issue_is_passed_through(self):
        fake_issue = {"claim": "King Louis Bonaparte was executed in 1793", "problem": "Conflates King Louis XVI and Napoleon Bonaparte."}
        with patch(
            "app.routers.notes.verify_study_kit_facts",
            return_value={"clean": False, "issues": [fake_issue]},
        ):
            result = _verify_facts("source text", {"summary": "...", "key_terms": []})
        assert result["ran"] is True
        assert result["clean"] is False
        assert result["issues"] == [fake_issue]

    def test_verification_failure_is_swallowed_not_raised(self):
        """A failure in the fact-check call itself (Gemini rate-limited,
        etc.) must never bubble up and break note generation — the whole
        point of this being a wrapper is that generation already succeeded
        by the time this runs."""
        with patch(
            "app.routers.notes.verify_study_kit_facts",
            side_effect=AIGenerationError("rate limited"),
        ):
            result = _verify_facts("source text", {"summary": "...", "key_terms": []})
        assert result == {"ran": False, "clean": True, "issues": []}
