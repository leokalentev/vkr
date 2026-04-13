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

export default function StudentHomePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    loadData();
  }, []);

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

  return (
    <AppShell
      sidebarTitle="Student"
      sidebarLinks={studentLinks}
      pageTitle="Личный кабинет студента"
      pageSubtitle="Просмотр посещаемости, оценок и рекомендаций"
    >
      {!me ? (
        <div>Загрузка...</div>
      ) : (
        <>
          <div style={profileCardStyle}>
            <h2 style={{ marginTop: 0, marginBottom: 8 }}>
              {me.last_name} {me.first_name} {me.middle_name}
            </h2>
            <p style={{ margin: 0, color: "#64748b" }}>{me.email}</p>
          </div>

          <div style={gridStyle}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Посещаемость</h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Lesson ID</th>
                    <th style={thStyle}>Статус</th>
                    <th style={thStyle}>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((a) => (
                    <tr key={a.id}>
                      <td style={tdStyle}>{a.lesson_id}</td>
                      <td style={tdStyle}>{a.status}</td>
                      <td style={tdStyle}>{a.confidence ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={cardStyle}>
              <h2 style={{ marginTop: 0 }}>Оценки</h2>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Max</th>
                    <th style={thStyle}>Final</th>
                    <th style={thStyle}>Комментарий</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td style={tdStyle}>{r.score ?? "-"}</td>
                      <td style={tdStyle}>{r.max_score ?? "-"}</td>
                      <td style={tdStyle}>{r.final_score ?? "-"}</td>
                      <td style={tdStyle}>{r.teacher_comment ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ marginTop: 0 }}>Рекомендации</h2>

            {recommendations.length === 0 ? (
              <p>Рекомендаций пока нет</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {recommendations.map((r) => (
                  <div key={r.id} style={recommendationCardStyle}>
                    <b>{r.title}</b>
                    <p>{r.text}</p>
                    <small>Тип: {r.recommendation_type}</small>

                    <div style={{ marginTop: 10 }}>
                      {r.is_read ? (
                        <span style={{ color: "green" }}>Прочитано</span>
                      ) : (
                        <button onClick={() => markAsRead(r.id)} style={secondaryButtonStyle}>
                          Отметить как прочитано
                        </button>
                      )}
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

const profileCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  marginBottom: 24,
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 24,
};

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 20,
  boxShadow: "0 2px 10px rgba(15, 23, 42, 0.04)",
};

const recommendationCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 16,
  background: "#f8fafc",
};

const secondaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "white",
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