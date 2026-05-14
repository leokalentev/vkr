"""
Pytest configuration and shared fixtures.

Must be the FIRST module executed. Patches are applied before any app import.
"""
import os
import sys

# ── Env vars (before settings are read) ──────────────────────────────────
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_vkr.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-at-least-32-chars-long!")
os.environ.setdefault("ALGORITHM", "HS256")

# ── SQLite compatibility patches (must happen before app/models.py import) ─
import sqlalchemy
from sqlalchemy import Integer as _Integer, JSON as _JSON
import sqlalchemy.dialects.postgresql as _pg

# BigInteger → Integer so SQLite uses ROWID autoincrement
sqlalchemy.BigInteger = _Integer  # type: ignore[assignment]

# JSONB → JSON (SQLite has no native JSON binary type)
_pg.JSONB = _JSON  # type: ignore[attr-defined]

# ── App imports (now safe) ─────────────────────────────────────────────────
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from app.database import Base, get_db
from app.main import app
from app import models
from app.security import hash_password

# ---------------------------------------------------------------------------
# Test DB — SQLite file (so it persists across connections in the same run)
# ---------------------------------------------------------------------------
TEST_DB_URL = "sqlite:///./test_vkr.db"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    import pathlib, time
    try:
        time.sleep(0.1)
        pathlib.Path("./test_vkr.db").unlink(missing_ok=True)
    except PermissionError:
        pass  # Windows may hold the file; it will be overwritten on next run


@pytest.fixture()
def db():
    """Per-test DB session, rolled back after each test for isolation."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSession(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db):
    """TestClient with DB overridden and FaceEngine mocked."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with patch("app.main._preload_engines"):
        with patch("app.main.get_engines") as mock_engines:
            mock_face = MagicMock()
            mock_pose = MagicMock()
            mock_engines.return_value = (mock_face, mock_pose)
            with TestClient(app, raise_server_exceptions=True) as c:
                yield c

    app.dependency_overrides.pop(get_db, None)


# ---------------------------------------------------------------------------
# Factory helpers used by test modules
# ---------------------------------------------------------------------------

def make_admin(db, email="admin@test.com"):
    user = models.User(
        email=email,
        password_hash=hash_password("adminpass"),
        first_name="Admin",
        last_name="User",
        role=models.UserRole.ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_teacher(db, email="teacher@test.com"):
    user = models.User(
        email=email,
        password_hash=hash_password("teacherpass"),
        first_name="Teacher",
        last_name="User",
        role=models.UserRole.TEACHER,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_student(db, email="student@test.com"):
    import uuid
    user = models.User(
        email=email,
        password_hash=hash_password("studentpass"),
        first_name="Student",
        last_name="User",
        role=models.UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    db.flush()
    profile = models.StudentProfile(
        user_id=user.id,
        student_identifier=str(uuid.uuid4())[:8],
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user


def auth_header(client, email: str, password: str) -> dict:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
