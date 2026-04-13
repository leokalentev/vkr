import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";

type UserRole = "admin" | "teacher" | "student";

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("student");

  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<User[]>("/users/");
      setUsers(res.data);
      setError("");
    } catch {
      setError("Не удалось загрузить пользователей");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async () => {
    if (!email.trim() || !firstName.trim() || !lastName.trim() || !password.trim()) {
      setCreateError("Заполни email, имя, фамилию и пароль");
      setCreateSuccess("");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError("");
      setCreateSuccess("");

      await api.post("/users/", {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_name: middleName.trim() || null,
        password: password.trim(),
        role,
      });

      setCreateSuccess("Пользователь успешно создан");
      setEmail("");
      setFirstName("");
      setLastName("");
      setMiddleName("");
      setPassword("");
      setRole("student");

      await loadUsers();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || "Не удалось создать пользователя");
      setCreateSuccess("");
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка пользователей...</div>;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link to="/admin">← Назад в админку</Link>
      </div>

      <h1 style={{ marginBottom: 20 }}>Пользователи</h1>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Создать пользователя</h2>

        <div style={formGridStyle}>
          <input
            style={inputStyle}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          />

          <input
            style={inputStyle}
            type="text"
            placeholder="Имя"
            value={firstName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
          />

          <input
            style={inputStyle}
            type="text"
            placeholder="Фамилия"
            value={lastName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
          />

          <input
            style={inputStyle}
            type="text"
            placeholder="Отчество"
            value={middleName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setMiddleName(e.target.value)}
          />

          <input
            style={inputStyle}
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          />

          <select
            style={inputStyle}
            value={role}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setRole(e.target.value as UserRole)}
          >
            <option value="student">student</option>
            <option value="teacher">teacher</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div style={{ marginTop: 16 }}>
          <button onClick={handleCreateUser} disabled={createLoading}>
            {createLoading ? "Создание..." : "Создать пользователя"}
          </button>
        </div>

        {createError && <div style={{ color: "red", marginTop: 12 }}>{createError}</div>}
        {createSuccess && <div style={{ color: "green", marginTop: 12 }}>{createSuccess}</div>}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Список пользователей</h2>

        {error && <div style={{ color: "red", marginBottom: 12 }}>{error}</div>}

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>ФИО</th>
              <th style={thStyle}>Роль</th>
              <th style={thStyle}>Активен</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={tdStyle}>{user.id}</td>
                <td style={tdStyle}>{user.email}</td>
                <td style={tdStyle}>
                  {user.last_name} {user.first_name} {user.middle_name ?? ""}
                </td>
                <td style={tdStyle}>{user.role}</td>
                <td style={tdStyle}>{user.is_active ? "Да" : "Нет"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 20,
  marginBottom: 24,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const inputStyle: CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
  background: "#f3f4f6",
};

const tdStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
};