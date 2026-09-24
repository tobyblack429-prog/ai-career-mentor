import os
import sys
import pytest
from pathlib import Path

# Ensure backend root is in sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Override the database URL to use a dedicated test database
# This keeps tests completely isolated from the local dev database (dev.db)
TEST_DB_PATH = Path(__file__).parent.parent / "test.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["AUTH_DISABLED"] = "false"

@pytest.fixture(scope="session", autouse=True)
def clean_test_db():
    # Allow tests to execute
    yield
    # Clean up test.db after the entire test session completes
    if TEST_DB_PATH.exists():
        try:
            TEST_DB_PATH.unlink()
        except Exception:
            pass
