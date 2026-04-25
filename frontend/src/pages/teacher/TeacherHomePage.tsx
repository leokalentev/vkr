import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent, ReactNode } from "react";
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
  group: { id: number; name: string };
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

// ---- SVG Icons ----
const IconFolder = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const IconUsers = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconTrendUp = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
  </svg>
);
const IconTrendDown = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
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
      setError("Не удалось загрузить домашнюю страницу");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadHome(); }, []);

  const stats = useMemo(() => {
    const allStudents = Object.values(studentsByGroup).flat();
    const uniqueStudentsMap = new Map<number, StudentShort>();
    for (const s of allStudents) uniqueStudentsMap.set(s.id, s);

    const allAnalyticsStudents = Object.values(analyticsByGroup).flatMap((g) => g.students);
    const uniqueAnalyticsMap = new Map<number, GroupAnalyticsStudent>();
    for (const item of allAnalyticsStudents) uniqueAnalyticsMap.set(item.student.id, item);

    let highCount = 0, lowCount = 0;
    for (const item of uniqueAnalyticsMap.values()) {
      if (item.engagement_level === "high") highCount++;
      if (item.engagement_level === "low") lowCount++;
    }

    return { totalGroups: groups.length, totalStudents: uniqueStudentsMap.size, highCount, lowCount };
  }, [groups, studentsByGroup, analyticsByGroup]);

  const handleCreateGroup = async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) { setCreateError("Введите название группы"); setCreateSuccess(""); return; }
    try {
      setCreateLoading(true);
      setCreateError("");
      setCreateSuccess("");
      await api.post("/groups/", { name: trimmedName });
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
      sidebarTitle="Преподаватель"
      sidebarLinks={teacherLinks}
      pageTitle="Личный кабинет преподавателя"
      pageSubtitle="Главная страница аналитической системы вовлечённости студентов"
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
          {/* Stat grid */}
          <div style={gridStyle}>
            <StatCard title="Групп" value={String(stats.totalGroups)} hint="Под управлением"
              icon={<IconFolder />} gradient="linear-gradient(135deg,#2563eb,#3b82f6)" shadowColor="rgba(37,99,235,0.28)" />
            <StatCard title="Студентов" value={String(stats.totalStudents)} hint="Уникальных"
              icon={<IconUsers />} gradient="linear-gradient(135deg,#0891b2,#06b6d4)" shadowColor="rgba(8,145,178,0.28)" />
            <StatCard title="Высокая вовлечённость" value={String(stats.highCount)} hint="Активные студенты"
              icon={<IconTrendUp />} gradient="linear-gradient(135deg,#059669,#10b981)" shadowColor="rgba(5,150,105,0.28)" />
            <StatCard title="Низкая вовлечённость" value={String(stats.lowCount)} hint="Требуют внимания"
              icon={<IconTrendDown />} gradient="linear-gradient(135deg,#dc2626,#f87171)" shadowColor="rgba(220,38,38,0.28)" />
          </div>

          {/* Create group card */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Создать новую группу</h2>
            <p style={sectionSubtitleStyle}>Введите название учебной группы и нажмите «Создать»</p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
              <input
                type="text"
                placeholder="Например, ИС-203"
                value={newGroupName}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                style={inputStyle}
              />
              <button onClick={handleCreateGroup} disabled={createLoading} style={primaryButtonStyle}>
                {createLoading ? "Создание..." : "Создать группу"}
              </button>
            </div>

            {createError && <div style={inlineErrorStyle}>{createError}</div>}
            {createSuccess && <div style={inlineSuccessStyle}>{createSuccess}</div>}
          </div>

          {/* Groups table */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={sectionTitleStyle}>Мои группы</h2>
                <p style={sectionSubtitleStyle}>Список групп под вашим управлением</p>
              </div>
              <Link to="/groups" style={{ textDecoration: "none" }}>
                <button style={outlineButtonStyle}>Все группы →</button>
              </Link>
            </div>

            {groups.length === 0 ? (
              <div style={emptyStyle}>Групп пока нет. Создайте первую группу выше.</div>
            ) : (
              <div style={tableWrapStyle}>
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
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{group.name}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={badgeBlueStyle}>{students.length}</span>
                          </td>
                          <td style={tdStyle}>
                            {analytics?.average_integral_engagement_score != null ? (
                              <span style={{ fontWeight: 600, color: "#0f172a" }}>
                                {analytics.average_integral_engagement_score.toFixed(3)}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {analytics?.top_student ? (
                              <span style={{ fontWeight: 500 }}>
                                {analytics.top_student.last_name} {analytics.top_student.first_name}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <Link to={`/groups/${group.id}`} style={linkBtnStyle}>Открыть</Link>
                              <Link to={`/groups/${group.id}/analytics`} style={{ ...linkBtnStyle, ...linkBtnAltStyle }}>Аналитика</Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 20,
  padding: "22px 24px",
  boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
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

const inputStyle: CSSProperties = {
  minWidth: 260,
  padding: "11px 14px",
  border: "1.5px solid #e2e8f0",
  borderRadius: 12,
  fontSize: 14,
  color: "#0f172a",
  background: "#f8fafc",
  flex: "1 1 260px",
};

const primaryButtonStyle: CSSProperties = {
  padding: "11px 20px",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(37,99,235,0.3)",
  flexShrink: 0,
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

const inlineErrorStyle: CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  borderRadius: 10,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#dc2626",
  fontSize: 13,
};

const inlineSuccessStyle: CSSProperties = {
  marginTop: 12,
  padding: "10px 14px",
  borderRadius: 10,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  color: "#16a34a",
  fontSize: 13,
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
  justifyContent: "center",
  minWidth: 28,
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const linkBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "5px 12px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  background: "#eff6ff",
  color: "#2563eb",
  textDecoration: "none",
  border: "1px solid #dbeafe",
};

const linkBtnAltStyle: CSSProperties = {
  background: "#f0fdf4",
  color: "#16a34a",
  border: "1px solid #bbf7d0",
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
