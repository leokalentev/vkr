import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import type { CSSProperties, ReactNode } from "react";
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
  { label: "Главная", to: "/admin", icon: "home" },
  { label: "Пользователи", to: "/admin/users", icon: "users" },
  { label: "Группы", to: "/admin/groups", icon: "groups" },
];

// ---- SVG icons ----
const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconShield = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconBriefcase = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const IconBook = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IconLayers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
  </svg>
);

// ---- Stat card ----
type StatCardProps = {
  title: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  gradient: string;
  shadowColor: string;
};

function StatCard({ title, value, hint, icon, gradient, shadowColor }: StatCardProps) {
  return (
    <div style={statCardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={statLabelStyle}>{title}</div>
          <div style={statValueStyle}>{value}</div>
          {hint && <div style={statHintStyle}>{hint}</div>}
        </div>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: gradient,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          flexShrink: 0,
          boxShadow: `0 6px 16px ${shadowColor}`,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

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

  const stats = useMemo(() => ({
    totalUsers: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    teachers: users.filter((u) => u.role === "teacher").length,
    students: users.filter((u) => u.role === "student").length,
    totalGroups: groups.length,
  }), [users, groups]);

  return (
    <AppShell
      sidebarTitle="Администратор"
      sidebarLinks={adminLinks}
      pageTitle="Панель администратора"
      pageSubtitle="Управление пользователями, группами и структурой системы"
    >
      {loading ? (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          Загрузка данных...
        </div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : (
        <>
          {/* Hero card */}
          <div style={heroCardStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={heroTitleStyle}>Информационная система анализа вовлечённости</h2>
              <p style={heroSubtitleStyle}>
                Контролируйте пользователей, учебные группы и организационную структуру платформы.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
              <Link to="/admin/users" style={{ textDecoration: "none" }}>
                <button style={primaryButtonStyle}>Пользователи</button>
              </Link>
              <Link to="/admin/groups" style={{ textDecoration: "none" }}>
                <button style={secondaryButtonStyle}>Группы</button>
              </Link>
            </div>
          </div>

          {/* Stat grid */}
          <div style={gridStyle}>
            <StatCard title="Всего пользователей" value={String(stats.totalUsers)} hint="Все роли системы"
              icon={<IconUsers />} gradient="linear-gradient(135deg,#2563eb,#3b82f6)" shadowColor="rgba(37,99,235,0.3)" />
            <StatCard title="Администраторы" value={String(stats.admins)} hint="Полный доступ"
              icon={<IconShield />} gradient="linear-gradient(135deg,#7c3aed,#a855f7)" shadowColor="rgba(124,58,237,0.3)" />
            <StatCard title="Преподаватели" value={String(stats.teachers)} hint="Работа с аналитикой"
              icon={<IconBriefcase />} gradient="linear-gradient(135deg,#0891b2,#06b6d4)" shadowColor="rgba(8,145,178,0.3)" />
            <StatCard title="Студенты" value={String(stats.students)} hint="Участники обучения"
              icon={<IconBook />} gradient="linear-gradient(135deg,#059669,#10b981)" shadowColor="rgba(5,150,105,0.3)" />
            <StatCard title="Учебные группы" value={String(stats.totalGroups)} hint="Коллективы"
              icon={<IconLayers />} gradient="linear-gradient(135deg,#d97706,#f59e0b)" shadowColor="rgba(217,119,6,0.3)" />
          </div>

          {/* Groups table */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Последние группы</h2>
                <p style={sectionSubtitleStyle}>Недавно созданные учебные группы</p>
              </div>
              <Link to="/admin/groups" style={{ textDecoration: "none" }}>
                <button style={outlineButtonStyle}>Все группы →</button>
              </Link>
            </div>

            {groups.length === 0 ? (
              <div style={emptyStyle}>Группы пока не созданы</div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>ID</th>
                      <th style={thStyle}>Название</th>
                      <th style={thStyle}>Куратор</th>
                      <th style={thStyle}>Создана</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.slice(0, 5).map((group) => (
                      <tr key={group.id}>
                        <td style={{ ...tdStyle, color: "#94a3b8", fontSize: 13 }}>#{group.id}</td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 700, color: "#0f172a" }}>{group.name}</span>
                        </td>
                        <td style={tdStyle}>
                          {group.curator_id ? (
                            <span style={badgeBlueStyle}>ID: {group.curator_id}</span>
                          ) : (
                            <span style={badgeGrayStyle}>Не назначен</span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}>
                          {new Date(group.created_at).toLocaleDateString("ru-RU")}
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

// ---- Styles ----
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 16,
};

const statCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: "20px 22px",
  boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
};

const statLabelStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 500,
  marginBottom: 8,
};

const statValueStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1,
  marginBottom: 6,
};

const statHintStyle: CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
};

const heroCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, #eff6ff 0%, #fff 55%, #eef2ff 100%)",
  border: "1px solid #dbeafe",
  borderRadius: 20,
  padding: "24px 28px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
  boxShadow: "0 4px 20px rgba(37,99,235,0.07)",
};

const heroTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 6,
};

const heroSubtitleStyle: CSSProperties = {
  fontSize: 14,
  color: "#64748b",
  maxWidth: 480,
};

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: "22px 24px",
  boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 20,
  flexWrap: "wrap",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 4,
};

const sectionSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
};

const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(37,99,235,0.3)",
};

const secondaryButtonStyle: CSSProperties = {
  background: "#ffffff",
  color: "#1e293b",
  border: "1.5px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 18px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const outlineButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#2563eb",
  border: "1.5px solid #dbeafe",
  borderRadius: 10,
  padding: "8px 14px",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "13px 16px",
  borderBottom: "1px solid #f1f5f9",
  color: "#334155",
  fontSize: 14,
};

const emptyStyle: CSSProperties = {
  padding: "32px 16px",
  textAlign: "center",
  color: "#94a3b8",
  fontSize: 14,
};

const badgeBlueStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const badgeGrayStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "#f1f5f9",
  color: "#64748b",
};

const loadingStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "40px 20px",
  color: "#64748b",
  fontSize: 15,
};

const spinnerStyle: CSSProperties = {
  width: 20,
  height: 20,
  border: "2.5px solid #e2e8f0",
  borderTopColor: "#2563eb",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const errorStyle: CSSProperties = {
  padding: "16px 20px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#dc2626",
  fontSize: 14,
};
