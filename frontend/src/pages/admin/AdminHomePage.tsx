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
  { label: "Главная", to: "/admin" },
  { label: "Пользователи", to: "/admin/users" },
  { label: "Группы", to: "/admin/groups" },
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
      sidebarTitle="Admin"
      sidebarLinks={adminLinks}
      pageTitle="Личный кабинет администратора"
      pageSubtitle="Управление пользователями и группами системы"
    >
      {loading ? (
        <div style={{ padding: 20 }}>Загрузка кабинета администратора...</div>
      ) : error ? (
        <div style={{ padding: 20, color: "red" }}>{error}</div>
      ) : (
        <>
          <div style={gridStyle}>
            <StatCard title="Всего пользователей" value={String(stats.totalUsers)} />
            <StatCard title="Администраторов" value={String(stats.admins)} />
            <StatCard title="Преподавателей" value={String(stats.teachers)} />
            <StatCard title="Студентов" value={String(stats.students)} />
            <StatCard title="Групп" value={String(stats.totalGroups)} />
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Быстрые действия</h2>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <Link to="/admin/users">Пользователи</Link>
              <Link to="/admin/groups">Группы</Link>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Последние группы</h2>

            {groups.length === 0 ? (
              <p>Групп пока нет</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Название</th>
                    <th style={thStyle}>Curator ID</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.slice(0, 5).map((group) => (
                    <tr key={group.id}>
                      <td style={tdStyle}>{group.id}</td>
                      <td style={tdStyle}>{group.name}</td>
                      <td style={tdStyle}>{group.curator_id ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ fontSize: 15, color: "#64748b", marginBottom: 10 }}>{title}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: "#0f172a" }}>{value}</div>
    </div>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const statCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
};

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  marginBottom: 24,
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: "12px 10px",
  textAlign: "left",
  background: "#f8fafc",
};

const tdStyle: CSSProperties = {
  borderBottom: "1px solid #e2e8f0",
  padding: "12px 10px",
};