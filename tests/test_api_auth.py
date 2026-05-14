"""Functional tests for /auth/* endpoints."""
import pytest

from tests.conftest import make_admin, make_student, make_teacher, auth_header


class TestRegister:
    def test_register_new_user(self, client):
        resp = client.post("/auth/register", json={
            "email": "newuser@example.com",
            "password": "securepass123",
            "first_name": "New",
            "last_name": "User",
            "role": "student",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "student"
        assert "id" in data

    def test_register_duplicate_email_returns_400(self, client, db):
        make_admin(db, email="dupe@test.com")
        resp = client.post("/auth/register", json={
            "email": "dupe@test.com",
            "password": "pass",
            "first_name": "A",
            "last_name": "B",
            "role": "student",
        })
        assert resp.status_code == 400

    def test_register_returns_no_password_field(self, client):
        resp = client.post("/auth/register", json={
            "email": "safe@test.com",
            "password": "abc123",
            "first_name": "X",
            "last_name": "Y",
            "role": "teacher",
        })
        assert resp.status_code == 200
        assert "password" not in resp.json()
        assert "password_hash" not in resp.json()


class TestLogin:
    def test_login_with_correct_credentials(self, client, db):
        make_admin(db, email="logintest@test.com")
        resp = client.post("/auth/login", json={
            "email": "logintest@test.com",
            "password": "adminpass",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password_returns_401(self, client, db):
        make_admin(db, email="wrongpass@test.com")
        resp = client.post("/auth/login", json={
            "email": "wrongpass@test.com",
            "password": "incorrect",
        })
        assert resp.status_code == 401

    def test_login_nonexistent_email_returns_401(self, client):
        resp = client.post("/auth/login", json={
            "email": "nobody@nowhere.com",
            "password": "pass",
        })
        assert resp.status_code == 401

    def test_token_is_string(self, client, db):
        make_teacher(db, email="tokentest@test.com")
        resp = client.post("/auth/login", json={
            "email": "tokentest@test.com",
            "password": "teacherpass",
        })
        assert isinstance(resp.json()["access_token"], str)


class TestMe:
    def test_me_returns_current_user(self, client, db):
        make_admin(db, email="metest@test.com")
        headers = auth_header(client, "metest@test.com", "adminpass")
        resp = client.get("/auth/me", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["email"] == "metest@test.com"

    def test_me_without_token_returns_401(self, client):
        resp = client.get("/auth/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self, client):
        resp = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert resp.status_code == 401

    def test_me_returns_role_field(self, client, db):
        make_teacher(db, email="roleme@test.com")
        headers = auth_header(client, "roleme@test.com", "teacherpass")
        resp = client.get("/auth/me", headers=headers)
        assert resp.json()["role"] == "teacher"
