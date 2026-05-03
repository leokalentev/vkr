import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ReactNode } from "react";
import AppShell from "../../components/layout/AppShell";

type Student = { id: number; first_name: string; last_name: string };

type StudentItem = {
  rank: number;
  student: Student;
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
  top_student: Student | null;
  students: StudentItem[];
};

const teacherLinks = [
  { label: "Главная", to: "/teacher" },
  { label: "Группы", to: "/groups" },
];

function fmtPct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}
function fmtScore50(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${(v * 50).toFixed(1)} / 50`;
}
function fmtIdx(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(3);
}
function engagementLabel(level: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    high: { label: "Высокая", bg: "#dcfce7", color: "#16a34a" },
    good: { label: "Хорошая", bg: "#d1fae5", color: "#059669" },
    medium: { label: "Средняя", bg: "#fef9c3", color: "#ca8a04" },
    low: { label: "Низкая", bg: "#fee2e2", color: "#dc2626" },
    insufficient_data: { label: "Нет данных", bg: "#f1f5f9", color: "#64748b" },
  };
  return map[level] ?? { label: level, bg: "#f1f5f9", color: "#64748b" };
}

function EngagementBadge({ level }: { level: string }) {
  const cfg = engagementLabel(level);
  return (
    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function StatCard({ title, value, sub, icon, gradient, shadowColor }: { title: string; value: string; sub?: string; icon: ReactNode; gradient: string; shadowColor: string }) {
  return (
    <div style={statCardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.4px" }}>{title}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: `0 6px 14px ${shadowColor}` }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function GroupAnalyticsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/groups/${id}/analytics-summary`)
      .then((res) => setData(res.data))
      .catch(() => setError("Не удалось загрузить аналитику группы"))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <AppShell
      sidebarTitle="Преподаватель"
      sidebarLinks={teacherLinks}
      pageTitle={data ? `Аналитика: ${data.group.name}` : "Аналитика группы"}
      pageSubtitle="Сводные показатели вовлечённости студентов группы"
    >
      {/* Breadcrumb */}
      <div style={breadcrumbStyle}>
        <Link to="/teacher" style={breadcrumbLinkStyle}>Главная</Link>
        <span style={sep}>/</span>
        <Link to="/groups" style={breadcrumbLinkStyle}>Группы</Link>
        <span style={sep}>/</span>
        <Link to={`/groups/${id}`} style={breadcrumbLinkStyle}>Группа #{id}</Link>
        <span style={sep}>/</span>
        <span style={{ color: "#0f172a", fontWeight: 700 }}>Аналитика</span>
      </div>

      {loading ? (
        <div style={loadingStyle}><div style={spinnerStyle} />Загрузка аналитики...</div>
      ) : error ? (
        <div style={errorStyle}>{error}</div>
      ) : !data ? (
        <div style={errorStyle}>Нет данных для отображения</div>
      ) : (
        <>
          {/* Stat cards */}
          <div style={gridStyle}>
            <StatCard
              title="Студентов в группе"
              value={String(data.total_students)}
              sub="человек"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              gradient="linear-gradient(135deg,#2563eb,#3b82f6)" shadowColor="rgba(37,99,235,0.28)"
            />
            <StatCard
              title="Средняя посещаемость"
              value={fmtPct(data.average_attendance_score)}
              sub="от общего числа занятий"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><polyline points="9 11 12 14 22 4"/></svg>}
              gradient="linear-gradient(135deg,#0891b2,#06b6d4)" shadowColor="rgba(8,145,178,0.28)"
            />
            <StatCard
              title="Средний балл по журналу"
              value={data.average_academic_score !== null ? `${(data.average_academic_score * 50).toFixed(1)}` : "—"}
              sub="из 50 возможных баллов"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>}
              gradient="linear-gradient(135deg,#7c3aed,#a855f7)" shadowColor="rgba(124,58,237,0.28)"
            />
            <StatCard
              title="Индекс вовлечённости"
              value={fmtIdx(data.average_engagement_index)}
              sub="по данным видеоанализа (0–1)"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>}
              gradient="linear-gradient(135deg,#d97706,#f59e0b)" shadowColor="rgba(217,119,6,0.28)"
            />
            <StatCard
              title="Интегральный индекс"
              value={fmtIdx(data.average_integral_engagement_score)}
              sub="0.30 × посещ. + 0.30 × учёба + 0.40 × вовл."
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>}
              gradient="linear-gradient(135deg,#059669,#10b981)" shadowColor="rgba(5,150,105,0.28)"
            />
          </div>

          {/* Rating table */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Рейтинг студентов</h2>
            <p style={sectionSubtitleStyle}>Нажмите на строку, чтобы открыть профиль студента · ранжирование по интегральному индексу</p>

            <div style={{ ...tableWrapStyle, marginTop: 16 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={{ ...thStyle, width: 48 }}>#</th>
                    <th style={thStyle}>Студент</th>
                    <th style={thStyle}>Посещаемость</th>
                    <th style={thStyle}>Балл по журналу</th>
                    <th style={thStyle}>Индекс вовлечённости</th>
                    <th style={thStyle}>Интегральный</th>
                    <th style={thStyle}>Уровень</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => {
                    const cfg = engagementLabel(s.engagement_level);
                    return (
                      <tr
                        key={s.student.id}
                        onClick={() => navigate(`/students/${s.student.id}`)}
                        style={trStyle}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ ...tdStyle, fontWeight: 700, fontSize: 15, color: s.rank <= 3 ? "#d97706" : "#94a3b8" }}>
                          {s.rank <= 3 ? (["🥇","🥈","🥉"][s.rank - 1]) : s.rank}
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ ...avatarStyle, background: s.rank === 1 ? "linear-gradient(135deg,#d97706,#f59e0b)" : "linear-gradient(135deg,#2563eb,#6366f1)" }}>
                              {s.student.first_name[0]}{s.student.last_name[0]}
                            </div>
                            <span style={{ fontWeight: 600, color: "#2563eb" }}>
                              {s.student.last_name} {s.student.first_name}
                            </span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          {s.attendance_score !== null ? (
                            <div>
                              <span style={boldNumStyle}>{(s.attendance_score * 100).toFixed(1)}%</span>
                              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>индекс: {fmtIdx(s.attendance_score)}</div>
                            </div>
                          ) : <span style={dashStyle}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {s.average_academic_score !== null ? (
                            <div>
                              <span style={boldNumStyle}>{(s.average_academic_score * 50).toFixed(1)}</span>
                              <span style={{ fontSize: 13, color: "#94a3b8" }}> / 50</span>
                            </div>
                          ) : <span style={dashStyle}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {s.average_engagement_index !== null ? (
                            <div>
                              <span style={boldNumStyle}>{fmtIdx(s.average_engagement_index)}</span>
                              <div style={{ marginTop: 4 }}>
                                <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                                  {cfg.label}
                                </span>
                              </div>
                            </div>
                          ) : <span style={dashStyle}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>
                            {fmtIdx(s.integral_engagement_score)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <EngagementBadge level={s.engagement_level} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---- Styles ----
const breadcrumbStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", flexWrap: "wrap" };
const breadcrumbLinkStyle: CSSProperties = { color: "#2563eb", textDecoration: "none", fontWeight: 500 };
const sep: CSSProperties = { color: "#cbd5e1" };
const loadingStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "40px 20px", color: "#64748b", fontSize: 15 };
const spinnerStyle: CSSProperties = { width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
const errorStyle: CSSProperties = { padding: "16px 20px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14 };
const gridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 };
const statCardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" };
const cardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "22px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" };
const sectionTitleStyle: CSSProperties = { fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 };
const sectionSubtitleStyle: CSSProperties = { fontSize: 13, color: "#64748b" };
const tableWrapStyle: CSSProperties = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const thStyle: CSSProperties = { textAlign: "left", padding: "11px 16px", background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" };
const tdStyle: CSSProperties = { padding: "13px 16px", borderBottom: "1px solid #f1f5f9", color: "#334155", fontSize: 14, verticalAlign: "middle" };
const trStyle: CSSProperties = { cursor: "pointer", transition: "background 0.15s" };
const avatarStyle: CSSProperties = { width: 32, height: 32, borderRadius: 9, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, flexShrink: 0 };
const boldNumStyle: CSSProperties = { fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" };
const dashStyle: CSSProperties = { color: "#94a3b8" };
