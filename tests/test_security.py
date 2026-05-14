"""Unit tests for app/security.py — password hashing and JWT."""
import time
from datetime import timedelta

import pytest
from jose import jwt

from app.security import hash_password, verify_password, create_access_token
from app.config import settings


class TestPasswordHashing:
    def test_hash_returns_string(self):
        h = hash_password("secret123")
        assert isinstance(h, str)

    def test_hash_is_not_plaintext(self):
        plain = "mysecretpassword"
        assert hash_password(plain) != plain

    def test_two_hashes_of_same_password_differ(self):
        """Salt must make each hash unique."""
        h1 = hash_password("password")
        h2 = hash_password("password")
        assert h1 != h2

    def test_verify_correct_password(self):
        h = hash_password("correct_horse")
        assert verify_password("correct_horse", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("correct_horse")
        assert verify_password("wrong_horse", h) is False

    def test_verify_empty_string(self):
        h = hash_password("nonempty")
        assert verify_password("", h) is False

    def test_hash_empty_password(self):
        h = hash_password("")
        assert verify_password("", h) is True


class TestCreateAccessToken:
    def test_returns_string(self):
        token = create_access_token({"sub": "1"})
        assert isinstance(token, str)

    def test_payload_is_preserved(self):
        token = create_access_token({"sub": "42", "role": "teacher"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["sub"] == "42"
        assert payload["role"] == "teacher"

    def test_token_contains_exp(self):
        token = create_access_token({"sub": "1"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert "exp" in payload

    def test_custom_expires_delta(self):
        before = int(time.time())
        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=10))
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["exp"] - before <= 15  # allow some clock skew

    def test_expired_token_raises(self):
        token = create_access_token({"sub": "1"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(Exception):
            jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

    def test_wrong_secret_raises(self):
        token = create_access_token({"sub": "1"})
        with pytest.raises(Exception):
            jwt.decode(token, "wrong-secret", algorithms=[settings.ALGORITHM])
