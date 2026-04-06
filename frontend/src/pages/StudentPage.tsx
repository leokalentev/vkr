import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import type { CSSProperties } from "react";

type StudentShortRead = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "student" | "teacher" | "admin";
};

type GroupShortRead = {
  id: number;
  name: string;
  curator_id: number | null;
};

type StudentAnalyticsSummary = {
  student: StudentShortRead;
  groups: GroupShortRead[];

  total_attendance_records: number;
  attended_records: number;
  attendance_rate_percent: number | null;
  attendance_score: number | null;

  total_assessment_results: number;
  average_academic_score: number | null;

  total_engagement_metrics: number;
  average_engagement_index: number | null;

  integral_engagement_score: number | null;
  engagement_level: string;
  component_weights: {
    base_weights?: Record<string, number>;
    normalized_weights?: Record<string, number>;
  };
};

type Recommendation = {
  id: number;
  student_id: number;
  lesson_id: number | null;
  recommendation_type: "academic" | "activity" | "risk" | "motivation";
  title: string;
  text: string;
  confidence_score: number | null;
  is_read: boolean;
  created_at: string;
};

export default function StudentPage() {
  const { id } = useParams();
  const [data, setData] = useState<StudentAnalyticsSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const [error, setError] = useState("");
  const [recError, setRecError] = useState("");

  const loadRecommendations = async () => {
    try {
      const res = await api.get(`/students/${id}/recommendations`);
      setRecommendations(res.data);
      setRecError("");
    } catch {
      setRecError("Не удалось загрузить рекомендации");
    }
  };

  useEffect(() => {
    const fetchStudentAnalytics = async () => {
      try {
        const res = await api.get(`/students/${id}/analytics-summary`);
        setData(res.data);
      } catch {
        setError("Не удалось загрузить аналитику студента");
      } finally {
        setLoading(false);
      }
    };

    fetchStudentAnalytics();
    loadRecommendations();
  }, [id]);

  const handleGenerateRecommendations = async () => {
    try {
      setRecLoading(true);
      await api.post(`/students/${id}/generate-recommendations`);
      await loadRecommendations();
    } catch {
      setRecError("Не удалось сгенерировать рекомендации");
    } finally {
      setRecLoading(false);
    }
  };

  const handleMarkAsRead = async (recommendationId: number) => {
    try {
      await api.patch(`/recommendations/${recommendationId}/read`);
      await loadRecommendations();
    } catch {
      setRecError("Не удалось отметить рекомендацию как прочитанную");
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка аналитики...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  }

  if (!data) {
    return <div style={{ padding: 20 }}>Нет данных</div>;
  }

  const studentName = [
    data.student.last_name,
    data.student.first_name,
    data.student.middle_name,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div style={{ maxWidth: 900, margin: "40px auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Link to="/groups">← Назад к группам</Link>
      </div>

      <h1 style={{ marginBottom: 8 }}>{studentName}</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Email: {data.student.email}
      </p>

      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Основная информация</h2>
        <p><strong>ID:</strong> {data.student.id}</p>
        <p>
          <strong>Группы:</strong>{" "}
          {data.groups.length > 0
            ? data.groups.map((g) => g.name).join(", ")
            : "Нет"}
        </p>
        <p><strong>Уровень вовлечённости:</strong> {data.engagement_level}</p>
        <p>
          <strong>Интегральный индекс:</strong>{" "}
          {formatValue(data.integral_engagement_score)}
        </p>
      </div>

      <div style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Посещаемость</h2>
          <p><strong>Всего записей:</strong> {data.total_attendance_records}</p>
          <p><strong>Посещено:</strong> {data.attended_records}</p>
          <p>
            <strong>Процент посещаемости:</strong>{" "}
            {formatPercent(data.attendance_rate_percent)}
          </p>
          <p>
            <strong>Attendance score:</strong>{" "}
            {formatValue(data.attendance_score)}
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Учебные результаты</h2>
          <p><strong>Всего оценок:</strong> {data.total_assessment_results}</p>
          <p>
            <strong>Средний академический балл:</strong>{" "}
            {formatValue(data.average_academic_score)}
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Метрики вовлечённости</h2>
          <p><strong>Всего метрик:</strong> {data.total_engagement_metrics}</p>
          <p>
            <strong>Средний engagement index:</strong>{" "}
            {formatValue(data.average_engagement_index)}
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Веса компонентов</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Компонент</th>
              <th style={thStyle}>Базовый вес</th>
              <th style={thStyle}>Нормализованный вес</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(data.component_weights.base_weights || {}).map((key) => (
              <tr key={key}>
                <td style={tdStyle}>{key}</td>
                <td style={tdStyle}>
                  {formatValue(data.component_weights.base_weights?.[key] ?? null)}
                </td>
                <td style={tdStyle}>
                  {formatValue(data.component_weights.normalized_weights?.[key] ?? null)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>Рекомендации</h2>

          <button onClick={handleGenerateRecommendations} disabled={recLoading}>
            {recLoading ? "Генерация..." : "Сгенерировать рекомендации"}
          </button>
        </div>

        {recError && (
          <div style={{ color: "red", marginBottom: 12 }}>{recError}</div>
        )}

        {recommendations.length === 0 ? (
          <p>Рекомендаций пока нет</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  padding: 16,
                  background: rec.is_read ? "#f8fafc" : "#fff",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 6px 0" }}>{rec.title}</h3>
                    <div style={{ fontSize: 14, color: "#666" }}>
                      Тип: {rec.recommendation_type} | confidence:{" "}
                      {formatValue(rec.confidence_score)}
                    </div>
                  </div>

                  <div style={{ fontSize: 14 }}>
                    {rec.is_read ? "Прочитано" : "Не прочитано"}
                  </div>
                </div>

                <p style={{ marginTop: 0 }}>{rec.text}</p>

                {!rec.is_read && (
                  <button onClick={() => handleMarkAsRead(rec.id)}>
                    Отметить как прочитанное
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatValue(value: number | null) {
  if (value === null || value === undefined) return "Нет данных";
  return value.toFixed(4);
}

function formatPercent(value: number | null) {
  if (value === null || value === undefined) return "Нет данных";
  return `${value.toFixed(2)}%`;
}

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 20,
  marginBottom: 20,
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginBottom: 20,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
  background: "#f3f4f6",
};

const tdStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
};