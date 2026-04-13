import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties } from "react";

type Student = {
  id: number;
  first_name: string;
  last_name: string;
};

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
  group: {
    id: number;
    name: string;
  };
  total_students: number;
  average_attendance_score: number | null;
  average_academic_score: number | null;
  average_engagement_index: number | null;
  average_integral_engagement_score: number | null;
  top_student: Student | null;
  students: StudentItem[];
};

export default function GroupAnalyticsPage() {
  const { id } = useParams();
  const [data, setData] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get(`/groups/${id}/analytics-summary`);
        setData(res.data);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [id]);

  if (loading) return <div style={{ padding: 20 }}>Загрузка...</div>;
  if (!data) return <div>Нет данных</div>;

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto" }}>
      <Link to={`/groups/${id}`}>← Назад к группе</Link>

      <h1 style={{ marginBottom: 20 }}>{data.group.name}</h1>

      <div style={gridStyle}>
        <Card title="Студентов" value={data.total_students} />
        <Card title="Средняя посещаемость" value={data.average_attendance_score} />
        <Card title="Средний академический" value={data.average_academic_score} />
        <Card title="Средний engagement" value={data.average_engagement_index} />
        <Card
          title="Интегральный индекс"
          value={data.average_integral_engagement_score}
        />
      </div>

      {data.top_student && (
        <div style={cardStyle}>
          <h2>🏆 Топ студент</h2>
          <p>
            {data.top_student.last_name} {data.top_student.first_name}
          </p>
        </div>
      )}

      <div style={cardStyle}>
        <h2>Рейтинг студентов</h2>

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>ФИО</th>
              <th style={th}>Attendance</th>
              <th style={th}>Academic</th>
              <th style={th}>Engagement</th>
              <th style={th}>Индекс</th>
              <th style={th}>Уровень</th>
            </tr>
          </thead>

          <tbody>
            {data.students.map((s) => (
              <tr key={s.student.id}>
                <td style={td}>{s.rank}</td>
                <td style={td}>
                  <Link to={`/students/${s.student.id}`}>
                    {s.student.last_name} {s.student.first_name}
                  </Link>
                </td>
                <td style={td}>{fmt(s.attendance_score)}</td>
                <td style={td}>{fmt(s.average_academic_score)}</td>
                <td style={td}>{fmt(s.average_engagement_index)}</td>
                <td style={td}>{fmt(s.integral_engagement_score)}</td>
                <td style={td}>{s.engagement_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number | null }) {
  return (
    <div style={cardStyle}>
      <h3>{title}</h3>
      <p>{fmt(value)}</p>
    </div>
  );
}

function fmt(v: number | null) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(3);
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const cardStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: 16,
  borderRadius: 8,
  background: "white",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  border: "1px solid #ddd",
  padding: 8,
  background: "#f3f4f6",
};

const td: CSSProperties = {
  border: "1px solid #ddd",
  padding: 8,
};