import { useEffect, useState } from "react";
import api from "../../api/client";
import type { CSSProperties } from "react";
import AppShell from "../../components/layout/AppShell";

type Me = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
};

type Attendance = {
  id: number;
  lesson_id: number;
  status: string;
  confidence?: number;
};

type Result = {
  id: number;
  score?: number;
  max_score?: number;
  final_score?: number;
  teacher_comment?: string;
};

type Recommendation = {
  id: number;
  title: string;
  text: string;
  recommendation_type: string;
  is_read: boolean;
};

const studentLinks = [
  { label: "Мой кабинет", to: "/student" },
];

function AttendanceBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    present: { bg: "#dcfce7", color: "#16a34a" },
    absent: { bg: "#fee2e2", color: "#dc2626" },
    late: { bg: "#fef9c3", color: "#ca8a04" },
  };
  const cfg = map[status.toLowerCase()] ?? { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.color,
    }}>
      {status}
    </span>
  );
}

export default function StudentHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const meRes = await api.get("/auth/me");
      const user = meRes.data;
      setMe(user);

      const [attRes, resRes, recRes] = await Promise.all([
        api.get(`/students/${user.id}/attendance`),
        api.get(`/students/${user.id}/results`),
        api.get(`/students/${user.id}/recommendations`),
      ]);

      setAttendance(attRes.data);
      setResults(resRes.data);
      setRecommendations(recRes.data);
    } catch (e) {
      console.error("Ошибка загрузки данных студента", e);
    }
  };

  const markAsRead = async (id: number) => {
    await api.patch(`/recommendations/${id}/read`);
    loadData();
  };

  const unreadCount = recommendations.filter((r) => !r.is_read).length;
  const presentCount = attendance.filter((a) => a.status.toLowerCase() === "present").length;

  const initials = me
    ? `${me.first_name[0] ?? ""}${me.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <AppShell
      sidebarTitle="Студент"
      sidebarLinks={studentLinks}
      pageTitle="Личный кабинет студента"
      pageSubtitle="Посещаемость, оценки и персональные рекомендации"
    >
      {!me ? (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          Загрузка данных...
        </div>
      ) : (
        <>
          {/* Profile hero */}
          <div style={profileCardStyle}>
            <div style={avatarLargeStyle}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={profileNameStyle}>
                {me.last_name} {me.first_name} {me.middle_name}
              </h2>
              <p style={profileEmailStyle}>{me.email}</p>
            </div>
            <div style={profileStatsStyle}>
              <div style={profileStatItemStyle}>
                <div style={profileStatValueStyle}>{attendance.length}</div>
                <div style={profileStatLabelStyle}>Занятий</div>
              </div>
              <div style={profileStatDivStyle} />
              <div style={profileStatItemStyle}>
                <div style={profileStatValueStyle}>{presentCount}</div>
                <div style={profileStatLabelStyle}>Посещено</div>
              </div>
              <div style={profileStatDivStyle} />
              <div style={profileStatItemStyle}>
                <div style={{ ...profileStatValueStyle, color: unreadCount > 0 ? "#f59e0b" : "#16a34a" }}>
                  {unreadCount}
                </div>
                <div style={profileStatLabelStyle}>Рекомендаций</div>
              </div>
            </div>
          </div>

          {/* Attendance + Results grid */}
          <div style={gridStyle}>
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>Посещаемость</h2>
              <p style={{ ...sectionSubtitleStyle, marginBottom: 14 }}>История занятий</p>
              {attendance.length === 0 ? (
                <div style={emptyStyle}>Данных о посещаемости пока нет</div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Занятие</th>
                        <th style={thStyle}>Статус</th>
                        <th style={thStyle}>Точность</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map((a) => (
                        <tr key={a.id}>
                          <td style={tdStyle}>#{a.lesson_id}</td>
                          <td style={tdStyle}><AttendanceBadge status={a.status} /></td>
                          <td style={tdStyle}>
                            {a.confidence != null
                              ? <span style={{ color: "#64748b" }}>{(a.confidence * 100).toFixed(0)}%</span>
                              : <span style={{ color: "#94a3b8" }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>Оценки</h2>
              <p style={{ ...sectionSubtitleStyle, marginBottom: 14 }}>Результаты работ</p>
              {results.length === 0 ? (
                <div style={emptyStyle}>Оценок пока нет</div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Балл</th>
                        <th style={thStyle}>Макс.</th>
                        <th style={thStyle}>Итог</th>
                        <th style={thStyle}>Комментарий</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r) => (
                        <tr key={r.id}>
                          <td style={tdStyle}><span style={{ fontWeight: 700 }}>{r.score ?? "—"}</span></td>
                          <td style={{ ...tdStyle, color: "#64748b" }}>{r.max_score ?? "—"}</td>
                          <td style={tdStyle}>
                            {r.final_score != null ? (
                              <span style={finalScoreBadgeStyle}>{r.final_score}</span>
                            ) : <span style={{ color: "#94a3b8" }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}>
                            {r.teacher_comment ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <h2 style={sectionTitleStyle}>Рекомендации</h2>
              {unreadCount > 0 && (
                <span style={unreadBadgeStyle}>{unreadCount} новых</span>
              )}
            </div>
            <p style={{ ...sectionSubtitleStyle, marginBottom: 16 }}>Персональные советы по улучшению вовлечённости</p>

            {recommendations.length === 0 ? (
              <div style={emptyStyle}>Рекомендаций пока нет</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recommendations.map((r) => (
                  <div key={r.id} style={{
                    ...recCardStyle,
                    ...(r.is_read ? {} : recCardUnreadStyle),
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={recTitleStyle}>{r.title}</div>
                        <p style={recTextStyle}>{r.text}</p>
                        <span style={recTypeBadgeStyle}>{r.recommendation_type}</span>
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        {r.is_read ? (
                          <span style={readBadgeStyle}>Прочитано</span>
                        ) : (
                          <button onClick={() => markAsRead(r.id)} style={markReadBtnStyle}>
                            Отметить прочитанным
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---- Styles ----
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

const profileCardStyle: CSSProperties = {
  background: "linear-gradient(135deg, #eff6ff 0%, #fff 55%, #eef2ff 100%)",
  border: "1px solid #dbeafe",
  borderRadius: 20,
  padding: "24px 28px",
  display: "flex",
  alignItems: "center",
  gap: 20,
  flexWrap: "wrap",
  boxShadow: "0 4px 20px rgba(37,99,235,0.07)",
};

const avatarLargeStyle: CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: 18,
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 22,
  flexShrink: 0,
  boxShadow: "0 6px 16px rgba(37,99,235,0.3)",
};

const profileNameStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: 4,
};

const profileEmailStyle: CSSProperties = {
  fontSize: 14,
  color: "#64748b",
};

const profileStatsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 20,
  marginLeft: "auto",
  flexShrink: 0,
};

const profileStatItemStyle: CSSProperties = {
  textAlign: "center",
};

const profileStatValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1,
};

const profileStatLabelStyle: CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  marginTop: 4,
};

const profileStatDivStyle: CSSProperties = {
  width: 1,
  height: 32,
  background: "#e2e8f0",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 16,
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
};

const sectionSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 4,
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  background: "#f8fafc",
  color: "#475569",
  fontWeight: 600,
  fontSize: 12,
  letterSpacing: "0.5px",
  textTransform: "uppercase",
  borderBottom: "1px solid #e2e8f0",
};

const tdStyle: CSSProperties = {
  padding: "11px 14px",
  borderBottom: "1px solid #f1f5f9",
  color: "#334155",
  fontSize: 14,
};

const emptyStyle: CSSProperties = {
  padding: "24px 0",
  textAlign: "center",
  color: "#94a3b8",
  fontSize: 14,
};

const finalScoreBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#dbeafe",
  color: "#1d4ed8",
};

const unreadBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#fef9c3",
  color: "#ca8a04",
};

const recCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: "16px 18px",
  background: "#f8fafc",
};

const recCardUnreadStyle: CSSProperties = {
  borderColor: "#bfdbfe",
  background: "#eff6ff",
};

const recTitleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 15,
  color: "#0f172a",
  marginBottom: 6,
};

const recTextStyle: CSSProperties = {
  fontSize: 14,
  color: "#475569",
  marginBottom: 10,
  lineHeight: 1.5,
};

const recTypeBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "3px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: "#e0e7ff",
  color: "#4338ca",
};

const readBadgeStyle: CSSProperties = {
  display: "inline-flex",
  padding: "4px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
  background: "#dcfce7",
  color: "#16a34a",
};

const markReadBtnStyle: CSSProperties = {
  padding: "7px 14px",
  borderRadius: 10,
  border: "1.5px solid #dbeafe",
  background: "white",
  color: "#2563eb",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
};
