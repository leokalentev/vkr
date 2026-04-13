import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";
import AppShell from "../../components/layout/AppShell";

type Group = {
  id: number;
  name: string;
  curator_id: number | null;
  created_at: string;
};

type StudentShort = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "student" | "teacher" | "admin";
};

type GroupAnalyticsStudent = {
  rank: number;
  student: StudentShort;
  attendance_score: number | null;
  average_academic_score: number | null;
  average_engagement_index: number | null;
  integral_engagement_score: number | null;
  engagement_level: string;
};

type GroupAnalytics = {
  group: {
    id: number;
    name: string;
  };
  total_students: number;
  average_attendance_score: number | null;
  average_academic_score: number | null;
  average_engagement_index: number | null;
  average_integral_engagement_score: number | null;
  top_student: StudentShort | null;
  students: GroupAnalyticsStudent[];
};

const teacherLinks = [
  { label: "Главная", to: "/teacher" },
  { label: "Группы", to: "/groups" },
];

export default function TeacherHomePage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentsByGroup, setStudentsByGroup] = useState<Record<number, StudentShort[]>>({});
  const [analyticsByGroup, setAnalyticsByGroup] = useState<Record<number, GroupAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newGroupName, setNewGroupName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  const loadHome = async () => {
    try {
      setLoading(true);
      setError("");

      const groupsRes = await api.get("/groups/");
      const loadedGroups: Group[] = groupsRes.data;
      setGroups(loadedGroups);

      const studentEntries = await Promise.all(
        loadedGroups.map(async (group) => {
          const res = await api.get(`/groups/${group.id}/students`);
          return [group.id, res.data] as const;
        })
      );

      const analyticsEntries = await Promise.all(
        loadedGroups.map(async (group) => {
          const res = await api.get(`/groups/${group.id}/analytics-summary`);
          return [group.id, res.data] as const;
        })
      );

      setStudentsByGroup(Object.fromEntries(studentEntries));
      setAnalyticsByGroup(Object.fromEntries(analyticsEntries));
    } catch {
      setError("Не удалось загрузить домашнюю страницу преподавателя");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHome();
  }, []);

  const stats = useMemo(() => {
    const allStudents = Object.values(studentsByGroup).flat();

    const uniqueStudentsMap = new Map<number, StudentShort>();
    for (const student of allStudents) {
      uniqueStudentsMap.set(student.id, student);
    }

    const allAnalyticsStudents = Object.values(analyticsByGroup).flatMap(
      (groupAnalytics) => groupAnalytics.students
    );

    const uniqueAnalyticsMap = new Map<number, GroupAnalyticsStudent>();
    for (const item of allAnalyticsStudents) {
      uniqueAnalyticsMap.set(item.student.id, item);
    }

    let highCount = 0;
    let lowCount = 0;

    for (const item of uniqueAnalyticsMap.values()) {
      if (item.engagement_level === "high") highCount += 1;
      if (item.engagement_level === "low") lowCount += 1;
    }

    return {
      totalGroups: groups.length,
      totalStudents: uniqueStudentsMap.size,
      highCount,
      lowCount,
    };
  }, [groups, studentsByGroup, analyticsByGroup]);

  const handleCreateGroup = async () => {
    const trimmedName = newGroupName.trim();

    if (!trimmedName) {
      setCreateError("Введите название группы");
      setCreateSuccess("");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError("");
      setCreateSuccess("");

      await api.post("/groups/", {
        name: trimmedName,
      });

      setCreateSuccess(`Группа "${trimmedName}" успешно создана`);
      setNewGroupName("");
      await loadHome();
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || "Не удалось создать группу");
      setCreateSuccess("");
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <AppShell
      sidebarTitle="Teacher"
      sidebarLinks={teacherLinks}
      pageTitle="Личный кабинет преподавателя"
      pageSubtitle="Главная страница аналитической системы вовлечённости студентов"
    >
      {loading ? (
        <div style={{ padding: 20 }}>Загрузка домашней страницы...</div>
      ) : error ? (
        <div style={{ padding: 20, color: "red" }}>{error}</div>
      ) : (
        <>
          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Создать группу</h2>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Например, ИС-203"
                value={newGroupName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewGroupName(e.target.value)}
                style={inputStyle}
              />

              <button onClick={handleCreateGroup} disabled={createLoading} style={primaryButtonStyle}>
                {createLoading ? "Создание..." : "Создать группу"}
              </button>
            </div>

            {createError && <div style={{ color: "red", marginTop: 12 }}>{createError}</div>}
            {createSuccess && <div style={{ color: "green", marginTop: 12 }}>{createSuccess}</div>}
          </div>

          <div style={gridStyle}>
            <StatCard title="Групп" value={String(stats.totalGroups)} />
            <StatCard title="Студентов" value={String(stats.totalStudents)} />
            <StatCard title="Высокая вовлечённость" value={String(stats.highCount)} />
            <StatCard title="Низкая вовлечённость" value={String(stats.lowCount)} />
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Мои группы</h2>

            {groups.length === 0 ? (
              <p>Групп пока нет</p>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Группа</th>
                    <th style={thStyle}>Студентов</th>
                    <th style={thStyle}>Средний индекс</th>
                    <th style={thStyle}>Топ студент</th>
                    <th style={thStyle}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((group) => {
                    const students = studentsByGroup[group.id] || [];
                    const analytics = analyticsByGroup[group.id];

                    return (
                      <tr key={group.id}>
                        <td style={tdStyle}>{group.name}</td>
                        <td style={tdStyle}>{students.length}</td>
                        <td style={tdStyle}>
                          {analytics?.average_integral_engagement_score != null
                            ? analytics.average_integral_engagement_score.toFixed(3)
                            : "—"}
                        </td>
                        <td style={tdStyle}>
                          {analytics?.top_student
                            ? `${analytics.top_student.last_name} ${analytics.top_student.first_name}`
                            : "—"}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <Link to={`/groups/${group.id}`}>Открыть группу</Link>
                            <Link to={`/groups/${group.id}/analytics`}>Аналитика</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

const inputStyle: CSSProperties = {
  minWidth: 260,
  padding: "12px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: 10,
};

const primaryButtonStyle: CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
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