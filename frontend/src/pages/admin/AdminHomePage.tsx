import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import type { CSSProperties } from "react";
import AppShell from "../../components/layout/AppShell";

type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "admin" | "teacher" | "student";
  is_active: boolean;
  created_at: string;
};

type Group = {
  id: number;
  name: string;
  curator_id: number | null;
  created_at: string;
};

const adminLinks = [
  { label: "Главная", to: "/admin", icon: "🏠" },
  { label: "Пользователи", to: "/admin/users", icon: "👥" },
  { label: "Группы", to: "/admin/groups", icon: "🎓" },
];

export default function AdminHomePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersRes, groupsRes] = await Promise.all([
          api.get<User[]>("/users/"),
          api.get<Group[]>("/groups/"),
        ]);

        setUsers(usersRes.data);
        setGroups(groupsRes.data);
      } catch {
        setError("Не удалось загрузить кабинет администратора");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin").length;
    const teachers = users.filter((u) => u.role === "teacher").length;
    const students = users.filter((u) => u.role === "student").length;

    return {
      totalUsers: users.length,
      admins,
      teachers,
      students,
      totalGroups: groups.length,
    };
  }, [users, groups]);

  return (
    <AppShell
      sidebarTitle="Администратор"
      sidebarLinks={adminLinks}
      pageTitle="Панель администратора"
      pageSubtitle="Управление пользователями, группами и структурой системы"
    >
      {loading ? (
        <div style={{ padding: 20 }}>Загрузка кабинета администратора...</div>
      ) : error ? (
        <div style={{ padding: 20, color: "#b91c1c" }}>{error}</div>
      ) : (
        <>
          <div
            style={{
              ...cardStyle,
              background:
                "linear-gradient(135deg, rgba(239,246,255,0.9) 0%, rgba(255,255,255,0.95) 55%, rgba(238,242,255,0.95) 100%)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <div>
                <h2 style={sectionTitleStyle}>Информационная система анализа вовлечённости</h2>
                <p style={sectionSubtitleStyle}>
                  Контролируйте пользователей, учебные группы и организационную структуру платформы.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to="/admin/users" style={{ textDecoration: "none" }}>
                  <button style={primaryButtonStyle}>👥 Пользователи</button>
                </Link>

                <Link to="/admin/groups" style={{ textDecoration: "none" }}>
                  <button style={secondaryButtonStyle}>🎓 Группы</button>
                </Link>
              </div>
            </div>
          </div>

          <div style={gridStyle}>
            <StatCard title="Всего пользователей" value={String(stats.totalUsers)} hint="Все роли системы" />
            <StatCard title="Администраторы" value={String(stats.admins)} hint="Полный доступ" />
            <StatCard title="Преподаватели" value={String(stats.teachers)} hint="Работа с аналитикой" />
            <StatCard title="Студенты" value={String(stats.students)} hint="Участники обучения" />
            <StatCard title="Группы" value={String(stats.totalGroups)} hint="Учебные коллективы" />
          </div>

          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Последние группы</h2>
            <p style={sectionSubtitleStyle}>Недавно созданные или доступные учебные группы</p>

            {groups.length === 0 ? (
              <div style={emptyStateStyle}>Группы пока не созданы</div>
            ) : (
              <div style={{ ...tableWrapperStyle, marginTop: 16 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Название</th>
                      <th style={thStyle}>Куратор</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.slice(0, 5).map((group) => (
                      <tr key={group.id}>
                        <td style={tdStyle}>{group.id}</td>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700 }}>{group.name}</div>
                        </td>
                        <td style={tdStyle}>
                          {group.curator_id ? (
                            <span style={badgeBlueStyle}>👤 ID: {group.curator_id}</span>
                          ) : (
                            <span style={badgeGrayStyle}>— Не назначен</span>
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

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: 14, color: "#64748b", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a" }}>{value}</div>
      {hint && <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>{hint}</div>}
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const statCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 20,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const cardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.88)",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 800,
  color: "#0f172a",
};

const sectionSubtitleStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#64748b",
};

const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#ffffff",
  color: "#1e293b",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "12px 18px",
  fontWeight: 700,
  cursor: "pointer",
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
  padding: "14px 16px",
  background: "#f8fafc",
  color: "#334155",
  fontWeight: 700,
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #e2e8f0",
  color: "#0f172a",
};

const emptyStateStyle: CSSProperties = {
  padding: "24px 16px",
  textAlign: "center",
  color: "#64748b",
};

const badgeBlueStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const badgeGrayStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#f1f5f9",
  color: "#475569",
};