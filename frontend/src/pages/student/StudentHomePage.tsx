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
};

type Result = {
  id: number;
  lesson_id: number;
  score?: number;
  max_score?: number;
  final_score?: number;
  teacher_comment?: string;
};

type Lesson = {
  id: number;
  title: string;
};

type AcademicSnapshot = {
  id: number;
  subject_name: string;
  total_classes: number;
  attended_classes: number;
  average_score: number;
  imported_at: string;
};

type EngagementMetric = {
  id: number;
  lesson_id: number;
  engagement_index: number;
  computed_at: string;
};

type HobbyRec = {
  hobby: string;
  description: string;
  score: number;
};

const ALL_TRAITS = [
  "Веселый", "Грустный", "Общительный", "Замкнутый",
  "Активный", "Спокойный", "Творческий", "Аналитический",
  "Добросердечный", "Целеустремлённый",
];

const MAX_TRAITS = 5;

const studentLinks = [{ label: "Мой кабинет", to: "/student" }];

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  present:  { label: "Присутствовал",   bg: "#dcfce7", color: "#16a34a" },
  absent:   { label: "Отсутствовал",    bg: "#fee2e2", color: "#dc2626" },
  late:     { label: "Опоздал",         bg: "#fef9c3", color: "#ca8a04" },
  excused:  { label: "Уважительная",    bg: "#e0e7ff", color: "#4338ca" },
};

function levelInfo(idx: number): { label: string; bg: string; color: string } {
  if (idx >= 0.75) return { label: "Высокая", bg: "#dcfce7", color: "#15803d" };
  if (idx >= 0.55) return { label: "Хорошая", bg: "#d1fae5", color: "#059669" };
  if (idx >= 0.33) return { label: "Средняя", bg: "#fef9c3", color: "#ca8a04" };
  return { label: "Низкая", bg: "#fee2e2", color: "#dc2626" };
}

export default function StudentHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [snapshots, setSnapshots] = useState<AcademicSnapshot[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [metrics, setMetrics] = useState<EngagementMetric[]>([]);

  // Personality traits & hobby recommendations
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState("");
  const [recommendations, setRecommendations] = useState<HobbyRec[] | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const meRes = await api.get("/auth/me");
      const user = meRes.data;
      setMe(user);

      const [attRes, snapRes, resRes, lessonRes, metRes] = await Promise.all([
        api.get(`/students/${user.id}/attendance`),
        api.get(`/students/${user.id}/academic-snapshots`).catch(() => ({ data: [] })),
        api.get(`/students/${user.id}/results`),
        api.get(`/students/${user.id}/lessons`).catch(() => ({ data: [] })),
        api.get(`/students/${user.id}/engagement-metrics`).catch(() => ({ data: [] })),
      ]);

      setAttendance(attRes.data);
      setSnapshots(snapRes.data);
      setResults(resRes.data);
      setLessons(lessonRes.data);
      setMetrics(metRes.data);
    } catch (e) {
      console.error("Ошибка загрузки данных студента", e);
    }
  };

  const toggleTrait = (trait: string) => {
    setSelectedTraits((prev) => {
      if (prev.includes(trait)) return prev.filter((t) => t !== trait);
      if (prev.length >= MAX_TRAITS) return prev;
      return [...prev, trait];
    });
    setRecommendations(null);
    setRecError("");
  };

  const handleGetRecommendations = async () => {
    if (!me || selectedTraits.length === 0) return;
    try {
      setRecLoading(true); setRecError(""); setRecommendations(null);
      const res = await api.post(`/students/${me.id}/hobby-recommendations`, { traits: selectedTraits });
      setRecommendations(res.data.recommendations);
    } catch (err: any) {
      setRecError(err?.response?.data?.detail || "Не удалось получить рекомендации");
    } finally { setRecLoading(false); }
  };

  const presentCount = attendance.filter((a) => ["present", "late"].includes(a.status.toLowerCase())).length;

  const avgEngagement = metrics.length > 0
    ? metrics.reduce((s, m) => s + m.engagement_index, 0) / metrics.length
    : null;

  const initials = me
    ? `${me.first_name[0] ?? ""}${me.last_name[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <AppShell
      sidebarTitle="Студент"
      sidebarLinks={studentLinks}
      pageTitle="Личный кабинет"
      pageSubtitle="Посещаемость, оценки и рекомендации"
    >
      {!me ? (
        <div style={loadingStyle}><div style={spinnerStyle} />Загрузка данных...</div>
      ) : (
        <>
          {/* Profile hero */}
          <div style={profileCardStyle}>
            <div style={avatarStyle}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={nameStyle}>{me.last_name} {me.first_name} {me.middle_name}</h2>
              <p style={emailStyle}>{me.email}</p>
            </div>
            <div style={statsRowStyle}>
              <div style={statItemStyle}>
                <div style={statValStyle}>{attendance.length}</div>
                <div style={statLblStyle}>Занятий</div>
              </div>
              <div style={dividerStyle} />
              <div style={statItemStyle}>
                <div style={statValStyle}>{presentCount}</div>
                <div style={statLblStyle}>Посещено</div>
              </div>
              <div style={dividerStyle} />
              <div style={statItemStyle}>
                <div style={statValStyle}>{metrics.length}</div>
                <div style={statLblStyle}>Мониторингов</div>
              </div>
            </div>
          </div>

          {/* Attendance */}
          <div style={cardStyle}>
            <h2 style={titleStyle}>Посещаемость</h2>
            <p style={subtitleStyle}>История занятий</p>
            {attendance.length === 0 ? (
              <div style={emptyStyle}>Данных о посещаемости пока нет</div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Занятие</th>
                      <th style={thStyle}>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => {
                      const cfg = STATUS_LABELS[a.status.toLowerCase()] ?? { label: a.status, bg: "#f1f5f9", color: "#64748b" };
                      return (
                        <tr key={a.id}>
                          <td style={tdStyle}>Занятие #{a.lesson_id}</td>
                          <td style={tdStyle}>
                            <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grades — semester + exam */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={gradeIconStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
              </div>
              <div>
                <h2 style={titleStyle}>Оценки</h2>
                <p style={subtitleStyle}>Баллы за семестр (журнал) + баллы за экзамен/зачёт · максимум 50 + 50 = 100</p>
              </div>
            </div>

            <div style={gradesGridStyle}>
              {/* Semester scores */}
              <div>
                <div style={subSectionLabelStyle}>
                  <div style={{ ...sectionDotStyle, background: "#7c3aed" }} />
                  Баллы за семестр (из журнала)
                </div>
                {snapshots.length === 0 ? (
                  <div style={emptyStyle}>Данных из журнала пока нет</div>
                ) : (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Предмет</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>Балл</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>Посещ.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshots.map((s) => {
                          const pct = s.total_classes > 0 ? Math.round(s.attended_classes / s.total_classes * 100) : 0;
                          return (
                            <tr key={s.id}>
                              <td style={{ ...tdStyle, fontWeight: 600 }}>{s.subject_name}</td>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                <span style={semesterBadgeStyle}>
                                  {s.average_score.toFixed(1)} <span style={{ fontWeight: 400, color: "#94a3b8" }}>/ 50</span>
                                </span>
                              </td>
                              <td style={{ ...tdStyle, textAlign: "center", color: "#64748b" }}>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Exam scores */}
              <div>
                <div style={subSectionLabelStyle}>
                  <div style={{ ...sectionDotStyle, background: "#2563eb" }} />
                  Баллы за экзамен / зачёт
                </div>
                {results.length === 0 ? (
                  <div style={emptyStyle}>Оценок за экзамен пока нет</div>
                ) : (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Занятие</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>Балл</th>
                          <th style={{ ...thStyle, textAlign: "center" }}>Итого</th>
                          <th style={thStyle}>Комментарий</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r) => {
                          // Find lesson title, then match to snapshot by subject_name
                          const lesson = lessons.find((l) => l.id === r.lesson_id);
                          const matchingSnap = lesson
                            ? snapshots.find((s) => s.subject_name.toLowerCase() === lesson.title.toLowerCase())
                            : undefined;
                          const avgSem = matchingSnap !== undefined
                            ? matchingSnap.average_score
                            : snapshots.length > 0
                              ? snapshots.reduce((acc, s) => acc + s.average_score, 0) / snapshots.length
                              : null;
                          const examScore = r.score ?? null;
                          const total = avgSem !== null && examScore !== null ? avgSem + examScore : null;
                          return (
                            <tr key={r.id}>
                              <td style={tdStyle}>{lesson ? lesson.title : `Занятие #${r.lesson_id}`}</td>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                {examScore != null
                                  ? <span style={examBadgeStyle}>{examScore} <span style={{ fontWeight: 400, color: "#94a3b8" }}>/ {r.max_score ?? 50}</span></span>
                                  : <span style={{ color: "#94a3b8" }}>—</span>}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "center" }}>
                                {total !== null ? (
                                  <span style={{ fontWeight: 800, fontSize: 16, color: total >= 60 ? "#16a34a" : total >= 40 ? "#ca8a04" : "#dc2626" }}>
                                    {total.toFixed(1)}<span style={{ fontWeight: 400, fontSize: 12, color: "#94a3b8" }}> / 100</span>
                                  </span>
                                ) : <span style={{ color: "#94a3b8" }}>—</span>}
                              </td>
                              <td style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}>{r.teacher_comment ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Engagement index summary */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <div style={engIconStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <div>
                <h2 style={titleStyle}>Индекс вовлечённости</h2>
                <p style={subtitleStyle}>Средний показатель по всем мониторингам</p>
              </div>
            </div>

            {metrics.length === 0 ? (
              <div style={emptyStyle}>Мониторинг пока не проводился</div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 52, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>
                    {avgEngagement!.toFixed(3)}
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>из 1.000 возможных</div>
                </div>
                <div>
                  {(() => {
                    const info = levelInfo(avgEngagement!);
                    return (
                      <span style={{ display: "inline-flex", padding: "6px 18px", borderRadius: 999, fontSize: 15, fontWeight: 700, background: info.bg, color: info.color }}>
                        {info.label} вовлечённость
                      </span>
                    );
                  })()}
                  <div style={{ marginTop: 10, fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    По данным <strong>{metrics.length}</strong> {metrics.length === 1 ? "мониторинга" : "мониторингов"}.<br />
                    Индекс учитывает: присутствие в кадре, внимательность, двигательную активность и баллы за работу.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hobby recommendations */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
              <div style={hobbyIconStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              </div>
              <div>
                <h2 style={titleStyle}>Подбор хобби</h2>
                <p style={subtitleStyle}>Выберите до {MAX_TRAITS} черт своего характера — система подберёт рекомендации</p>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, marginBottom: 18 }}>
              {ALL_TRAITS.map((trait) => {
                const selected = selectedTraits.includes(trait);
                const disabled = !selected && selectedTraits.length >= MAX_TRAITS;
                return (
                  <button
                    key={trait}
                    onClick={() => !disabled && toggleTrait(trait)}
                    style={{
                      padding: "8px 16px", borderRadius: 999, border: selected ? "none" : "1.5px solid #e2e8f0",
                      background: selected ? "linear-gradient(135deg,#2563eb,#6366f1)" : "#f8fafc",
                      color: selected ? "white" : disabled ? "#cbd5e1" : "#334155",
                      fontWeight: 600, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer",
                      transition: "all 0.15s", boxShadow: selected ? "0 3px 10px rgba(37,99,235,0.28)" : "none",
                    }}
                  >
                    {trait}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
              <button
                onClick={handleGetRecommendations}
                disabled={recLoading || selectedTraits.length === 0}
                style={{
                  ...getRecBtnStyle,
                  opacity: selectedTraits.length === 0 ? 0.5 : 1,
                  cursor: selectedTraits.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                {recLoading ? "Подбираем..." : "Получить рекомендации"}
              </button>
              {selectedTraits.length > 0 && (
                <span style={{ fontSize: 13, color: "#64748b" }}>
                  Выбрано: {selectedTraits.length} / {MAX_TRAITS}
                </span>
              )}
            </div>

            {recError && <div style={recErrStyle}>{recError}</div>}

            {recommendations && recommendations.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                  Рекомендованные хобби для вас:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  {recommendations.map((rec, i) => {
                    const isTop = i === 0;
                    return (
                      <div key={rec.hobby} style={{ ...recCardStyle, border: isTop ? "2px solid #6366f1" : "1px solid #e2e8f0", background: isTop ? "linear-gradient(135deg,#eff6ff,#eef2ff)" : "white" }}>
                        {isTop && (
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                            Лучшее совпадение
                          </div>
                        )}
                        <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 4 }}>{rec.hobby}</div>
                        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 10 }}>{rec.description}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${(rec.score / 10) * 100}%`, background: isTop ? "linear-gradient(90deg,#6366f1,#2563eb)" : "linear-gradient(90deg,#10b981,#059669)", borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>
                            {rec.score.toFixed(1)} / 10
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---- Styles ----
const loadingStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "40px 20px", color: "#64748b", fontSize: 15 };
const spinnerStyle: CSSProperties = { width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" };
const profileCardStyle: CSSProperties = { background: "linear-gradient(135deg,#eff6ff 0%,#fff 55%,#eef2ff 100%)", border: "1px solid #dbeafe", borderRadius: 20, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", boxShadow: "0 4px 20px rgba(37,99,235,0.07)" };
const avatarStyle: CSSProperties = { width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22, flexShrink: 0, boxShadow: "0 6px 16px rgba(37,99,235,0.3)" };
const nameStyle: CSSProperties = { fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 4 };
const emailStyle: CSSProperties = { fontSize: 14, color: "#64748b" };
const statsRowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 20, marginLeft: "auto", flexShrink: 0 };
const statItemStyle: CSSProperties = { textAlign: "center" };
const statValStyle: CSSProperties = { fontSize: 22, fontWeight: 800, color: "#0f172a", lineHeight: 1 };
const statLblStyle: CSSProperties = { fontSize: 11, color: "#94a3b8", marginTop: 4 };
const dividerStyle: CSSProperties = { width: 1, height: 32, background: "#e2e8f0" };
const cardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "22px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" };
const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 2 };
const subtitleStyle: CSSProperties = { fontSize: 13, color: "#64748b", marginBottom: 14 };
const tableWrapStyle: CSSProperties = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const thStyle: CSSProperties = { textAlign: "left", padding: "10px 14px", background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" };
const tdStyle: CSSProperties = { padding: "11px 14px", borderBottom: "1px solid #f1f5f9", color: "#334155", fontSize: 14 };
const emptyStyle: CSSProperties = { padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 };
const engIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#d97706,#f59e0b)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(217,119,6,0.28)" };
const hobbyIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(124,58,237,0.28)" };
const getRecBtnStyle: CSSProperties = { padding: "10px 22px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#2563eb,#6366f1)", color: "white", fontWeight: 700, fontSize: 14, boxShadow: "0 3px 10px rgba(37,99,235,0.28)" };
const recErrStyle: CSSProperties = { marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 };
const recCardStyle: CSSProperties = { borderRadius: 16, padding: "16px 18px", transition: "box-shadow 0.15s" };
const gradeIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(124,58,237,0.28)" };
const gradesGridStyle: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 };
const subSectionLabelStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 };
const sectionDotStyle: CSSProperties = { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 };
const semesterBadgeStyle: CSSProperties = { fontWeight: 700, fontSize: 14, color: "#7c3aed" };
const examBadgeStyle: CSSProperties = { fontWeight: 700, fontSize: 14, color: "#2563eb" };
