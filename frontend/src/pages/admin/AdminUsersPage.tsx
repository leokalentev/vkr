import { useEffect, useState } from "react";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";
import AppShell from "../../components/layout/AppShell";

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

const adminLinks = [
  { label: "Главная", to: "/admin", icon: "🏠" },
  { label: "Пользователи", to: "/admin/users", icon: "👥" },
  { label: "Группы", to: "/admin/groups", icon: "🎓" },
];

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

  const getRoleBadgeStyle = (role: UserRole): CSSProperties => {
    if (role === "admin") {
      return {
        background: "#ede9fe",
        color: "#6d28d9",
      };
    }

    if (role === "teacher") {
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
      };
    }

    return {
      background: "#dcfce7",
      color: "#15803d",
    };
  };

  return (
    <AppShell
      sidebarTitle="Администратор"
      sidebarLinks={adminLinks}
      pageTitle="Пользователи"
      pageSubtitle="Создание и управление участниками образовательной системы"
    >
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "40px 20px", color: "#64748b", fontSize: 15 }}>
          <div style={{ width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Загрузка пользователей...
        </div>
      ) : (
        <>
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Создать пользователя</h2>
            <p style={sectionSubtitleStyle}>
              Добавьте нового администратора, преподавателя или студента
            </p>

            <div style={{ ...formGridStyle, marginTop: 18 }}>
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
                <option value="student">Студент</option>
                <option value="teacher">Преподаватель</option>
                <option value="admin">Администратор</option>
              </select>
            </div>

            <div style={{ marginTop: 18 }}>
              <button onClick={handleCreateUser} disabled={createLoading} style={primaryButtonStyle}>
                {createLoading ? "Создание..." : "Создать пользователя"}
              </button>
            </div>

            {createError && <div style={messageErrorStyle}>{createError}</div>}
            {createSuccess && <div style={messageSuccessStyle}>{createSuccess}</div>}
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Список пользователей</h2>
            <p style={sectionSubtitleStyle}>Все зарегистрированные пользователи системы</p>

            {error && <div style={messageErrorStyle}>{error}</div>}

            {users.length === 0 ? (
              <div style={emptyStateStyle}>Пользователей пока нет</div>
            ) : (
              <div style={{ ...tableWrapperStyle, marginTop: 16 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>ФИО</th>
                      <th style={thStyle}>Роль</th>
                      <th style={thStyle}>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td style={tdStyle}>{user.id}</td>
                        <td style={tdStyle}>{user.email}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700 }}>
                            {user.last_name} {user.first_name}
                          </div>
                          <div style={{ color: "#64748b", fontSize: 13 }}>
                            {user.middle_name ?? "Без отчества"}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ ...badgeStyle, ...getRoleBadgeStyle(user.role) }}>
                            {user.role === "admin" && "Администратор"}
                            {user.role === "teacher" && "Преподаватель"}
                            {user.role === "student" && "Студент"}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {user.is_active ? (
                            <span style={{ ...badgeStyle, background: "#dcfce7", color: "#15803d" }}>Активен</span>
                          ) : (
                            <span style={{ ...badgeStyle, background: "#fee2e2", color: "#b91c1c" }}>Неактивен</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#64748b",
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};

const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const messageErrorStyle: CSSProperties = {
  marginTop: 12,
  color: "#b91c1c",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 12,
  padding: "12px 14px",
};

const messageSuccessStyle: CSSProperties = {
  marginTop: 12,
  color: "#166534",
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  borderRadius: 12,
  padding: "12px 14px",
};

const tableWrapperStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "11px 16px",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
};

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const emptyStateStyle: CSSProperties = {
  padding: "24px 16px",
  textAlign: "center",
  color: "#64748b",
};