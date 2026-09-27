"""Shared test fixtures.

Runs entirely offline: no real Supabase project and no real Gemini API key
are needed. app/config.py already defaults GEMINI_API_KEY/SUPABASE_URL/
SUPABASE_SERVICE_KEY to "" when the env vars aren't set, so importing the
app never fails — it's only calling out to those services that would, and
every test here mocks that boundary instead of hitting the network.
"""
import sys
from pathlib import Path

# Let `import app...` resolve the same way it does when uvicorn runs from
# backend/ directly, regardless of what directory pytest was invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth import get_current_user, CurrentUser


TEST_USER = CurrentUser(id="00000000-0000-0000-0000-000000000001", email="test@example.com")


@pytest.fixture
def client():
    """A TestClient with auth pre-satisfied as TEST_USER, so individual
    tests only need to mock the service-layer call they care about instead
    of also faking a Supabase JWT. Overrides are cleared after each test so
    one test's auth stub can never leak into the next."""
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_current_user, None)
