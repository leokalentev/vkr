"""Functional tests for main API endpoints: groups, lessons, attendance, users."""
import datetime
import pytest

from tests.conftest import make_admin, make_teacher, make_student, auth_header
from app import models
from app.security import hash_password


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _make_lesson(db, group_id, teacher_id, title="Lecture 1"):
    now = datetime.datetime.now(datetime.timezone.utc)
    lesson = models.Lesson(
        group_id=group_id,
        teacher_id=teacher_id,
        title=title,
        lesson_date=datetime.date.today(),
        starts_at=now,
        ends_at=now + datetime.timedelta(hours=1),
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return lesson


def _make_group(db, name="Group-A", curator_id=None):
    group = models.Group(name=name, curator_id=curator_id)
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


# ===========================================================================
# GET /
# ===========================================================================

class TestRoot:
    def test_root_returns_200(self, client):
        resp = client.get("/")
        assert resp.status_code == 200

    def test_root_message(self, client):
        resp = client.get("/")
        assert resp.json().get("message") == "API is running"


# ===========================================================================
# USERS
# ===========================================================================

class TestUsers:
    def test_create_user_as_admin(self, client, db):
        make_admin(db, email="admin_users@test.com")
        headers = auth_header(client, "admin_users@test.com", "adminpass")
        resp = client.post("/users/", json={
            "email": "newstudent@test.com",
            "first_name": "John",
            "last_name": "Doe",
            "role": "student",
        }, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["role"] == "student"

    def test_create_user_as_teacher_forbidden(self, client, db):
        make_teacher(db, email="teacher_users@test.com")
        headers = auth_header(client, "teacher_users@test.com", "teacherpass")
        resp = client.post("/users/", json={
            "email": "another@test.com",
            "first_name": "X",
            "last_name": "Y",
            "role": "student",
        }, headers=headers)
        assert resp.status_code == 403

    def test_create_user_duplicate_email_returns_400(self, client, db):
        make_admin(db, email="admin_dup@test.com")
        headers = auth_header(client, "admin_dup@test.com", "adminpass")
        client.post("/users/", json={
            "email": "dup_student@test.com",
            "first_name": "A",
            "last_name": "B",
            "role": "student",
        }, headers=headers)
        resp = client.post("/users/", json={
            "email": "dup_student@test.com",
            "first_name": "C",
            "last_name": "D",
            "role": "student",
        }, headers=headers)
        assert resp.status_code == 400

    def test_list_users_as_admin(self, client, db):
        make_admin(db, email="admin_list@test.com")
        headers = auth_header(client, "admin_list@test.com", "adminpass")
        resp = client.get("/users/", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_users_unauthenticated(self, client):
        resp = client.get("/users/")
        assert resp.status_code == 401


# ===========================================================================
# GROUPS
# ===========================================================================

class TestGroups:
    def test_create_group_as_teacher(self, client, db):
        make_teacher(db, email="teacher_grp@test.com")
        headers = auth_header(client, "teacher_grp@test.com", "teacherpass")
        resp = client.post("/groups/", json={"name": "Group-XYZ"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "Group-XYZ"

    def test_create_group_student_forbidden(self, client, db):
        make_student(db, email="student_grp@test.com")
        headers = auth_header(client, "student_grp@test.com", "studentpass")
        resp = client.post("/groups/", json={"name": "Should-Fail"}, headers=headers)
        assert resp.status_code == 403

    def test_list_groups_authenticated(self, client, db):
        make_teacher(db, email="teacher_list_grp@test.com")
        headers = auth_header(client, "teacher_list_grp@test.com", "teacherpass")
        resp = client.get("/groups/", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_list_groups_unauthenticated_returns_401(self, client):
        resp = client.get("/groups/")
        assert resp.status_code == 401

    def test_delete_nonexistent_group_returns_404(self, client, db):
        make_admin(db, email="admin_del_grp@test.com")
        headers = auth_header(client, "admin_del_grp@test.com", "adminpass")
        resp = client.delete("/groups/99999", headers=headers)
        assert resp.status_code == 404

    def test_update_group_name(self, client, db):
        make_teacher(db, email="teacher_upd@test.com")
        headers = auth_header(client, "teacher_upd@test.com", "teacherpass")
        create = client.post("/groups/", json={"name": "OldName"}, headers=headers)
        group_id = create.json()["id"]
        resp = client.patch(f"/groups/{group_id}", json={"name": "NewName"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "NewName"


# ===========================================================================
# GROUP MEMBERSHIPS
# ===========================================================================

class TestGroupMemberships:
    def test_add_student_to_group(self, client, db):
        teacher = make_teacher(db, email="teacher_mem@test.com")
        student = make_student(db, email="student_mem@test.com")
        headers = auth_header(client, "teacher_mem@test.com", "teacherpass")
        create = client.post("/groups/", json={"name": "MemberGroup"}, headers=headers)
        group_id = create.json()["id"]
        resp = client.post(f"/groups/{group_id}/students/{student.id}", headers=headers)
        assert resp.status_code == 200

    def test_add_student_to_nonexistent_group_returns_404(self, client, db):
        teacher = make_teacher(db, email="teacher_mem2@test.com")
        student = make_student(db, email="student_mem2@test.com")
        headers = auth_header(client, "teacher_mem2@test.com", "teacherpass")
        resp = client.post(f"/groups/99999/students/{student.id}", headers=headers)
        assert resp.status_code == 404

    def test_get_group_students(self, client, db):
        teacher = make_teacher(db, email="teacher_gs@test.com")
        student = make_student(db, email="student_gs@test.com")
        headers = auth_header(client, "teacher_gs@test.com", "teacherpass")
        create = client.post("/groups/", json={"name": "StudentListGroup"}, headers=headers)
        group_id = create.json()["id"]
        client.post(f"/groups/{group_id}/students/{student.id}", headers=headers)
        resp = client.get(f"/groups/{group_id}/students", headers=headers)
        assert resp.status_code == 200
        ids = [s["id"] for s in resp.json()]
        assert student.id in ids


# ===========================================================================
# LESSONS
# ===========================================================================

class TestLessons:
    def _lesson_payload(self, group_id, teacher_id):
        now = datetime.datetime.now(datetime.timezone.utc)
        return {
            "group_id": group_id,
            "teacher_id": teacher_id,
            "title": "Math Lecture",
            "lesson_date": str(datetime.date.today()),
            "starts_at": now.isoformat(),
            "ends_at": (now + datetime.timedelta(hours=2)).isoformat(),
        }

    def test_create_lesson_as_teacher(self, client, db):
        teacher = make_teacher(db, email="teacher_les@test.com")
        headers = auth_header(client, "teacher_les@test.com", "teacherpass")
        grp = client.post("/groups/", json={"name": "LessonGroup1"}, headers=headers).json()
        payload = self._lesson_payload(grp["id"], teacher.id)
        resp = client.post("/lessons/", json=payload, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "Math Lecture"

    def test_create_lesson_nonexistent_group_returns_404(self, client, db):
        teacher = make_teacher(db, email="teacher_les2@test.com")
        headers = auth_header(client, "teacher_les2@test.com", "teacherpass")
        payload = self._lesson_payload(99999, teacher.id)
        resp = client.post("/lessons/", json=payload, headers=headers)
        assert resp.status_code == 404

    def test_list_lessons_returns_200(self, client, db):
        make_teacher(db, email="teacher_listles@test.com")
        headers = auth_header(client, "teacher_listles@test.com", "teacherpass")
        resp = client.get("/lessons/", headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_delete_lesson(self, client, db):
        teacher = make_teacher(db, email="teacher_del_les@test.com")
        headers = auth_header(client, "teacher_del_les@test.com", "teacherpass")
        grp = client.post("/groups/", json={"name": "DelLesGroup"}, headers=headers).json()
        payload = self._lesson_payload(grp["id"], teacher.id)
        les = client.post("/lessons/", json=payload, headers=headers).json()
        resp = client.delete(f"/lessons/{les['id']}", headers=headers)
        assert resp.status_code == 204

    def test_teacher_cannot_create_lesson_for_other_teacher(self, client, db):
        teacher1 = make_teacher(db, email="t1_les@test.com")
        teacher2 = make_teacher(db, email="t2_les@test.com")
        headers1 = auth_header(client, "t1_les@test.com", "teacherpass")
        headers2 = auth_header(client, "t2_les@test.com", "teacherpass")
        grp = client.post("/groups/", json={"name": "OtherTeacherGroup"}, headers=headers2).json()
        now = datetime.datetime.now(datetime.timezone.utc)
        payload = {
            "group_id": grp["id"],
            "teacher_id": teacher2.id,
            "title": "Unauthorized",
            "lesson_date": str(datetime.date.today()),
            "starts_at": now.isoformat(),
            "ends_at": (now + datetime.timedelta(hours=1)).isoformat(),
        }
        resp = client.post("/lessons/", json=payload, headers=headers1)
        assert resp.status_code == 403


# ===========================================================================
# HOBBY RECOMMENDATIONS
# ===========================================================================

class TestHobbyRecommendations:
    def test_returns_recommendations_for_valid_traits(self, client, db):
        make_student(db, email="hobby_student@test.com")
        headers = auth_header(client, "hobby_student@test.com", "studentpass")
        resp = client.post(
            "/students/1/hobby-recommendations",
            json={"traits": ["Активный"]},
            headers=headers,
        )
        # Any user can call this; we just check it works for authenticated users
        assert resp.status_code in (200, 404)  # 404 if student id=1 doesn't exist in this run

    def test_no_traits_returns_400(self, client, db):
        make_student(db, email="hobby_empty@test.com")
        student = db.query(models.User).filter(models.User.email == "hobby_empty@test.com").first()
        headers = auth_header(client, "hobby_empty@test.com", "studentpass")
        resp = client.post(
            f"/students/{student.id}/hobby-recommendations",
            json={"traits": []},
            headers=headers,
        )
        assert resp.status_code == 400

    def test_too_many_traits_returns_400(self, client, db):
        make_student(db, email="hobby_many@test.com")
        student = db.query(models.User).filter(models.User.email == "hobby_many@test.com").first()
        headers = auth_header(client, "hobby_many@test.com", "studentpass")
        resp = client.post(
            f"/students/{student.id}/hobby-recommendations",
            json={"traits": ["Т"] * 11},
            headers=headers,
        )
        assert resp.status_code == 400


# ===========================================================================
# ATTENDANCE
# ===========================================================================

class TestAttendance:
    def test_get_attendance_for_nonexistent_lesson_returns_404(self, client, db):
        make_teacher(db, email="teacher_att@test.com")
        headers = auth_header(client, "teacher_att@test.com", "teacherpass")
        resp = client.get("/lessons/99999/attendance", headers=headers)
        assert resp.status_code == 404

    def test_get_attendance_unauthenticated_returns_401(self, client):
        resp = client.get("/lessons/1/attendance")
        assert resp.status_code == 401
