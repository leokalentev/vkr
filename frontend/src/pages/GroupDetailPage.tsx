import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";
import type { CSSProperties } from "react";

type Student = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "student" | "teacher" | "admin";
};

type ImportedStudent = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "student" | "teacher" | "admin";
};

type ImportStudentsResponse = {
  group_id: number;
  imported_count: number;
  imported_students: ImportedStudent[];
};

export default function GroupDetailPage() {
  const { id } = useParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<ImportStudentsResponse | null>(null);

  const fetchStudents = async () => {
    try {
      const res = await api.get(`/groups/${id}/students`);
      setStudents(res.data);
      setError("");
    } catch {
      setError("Не удалось загрузить студентов группы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [id]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setImportError("");
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError("Сначала выбери Excel-файл");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setImportLoading(true);
      setImportError("");
      setImportResult(null);

      const res = await api.post(`/groups/${id}/import-students`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setImportResult(res.data);
      setSelectedFile(null);
      await fetchStudents();
    } catch (err: any) {
      setImportError(
        err?.response?.data?.detail || "Не удалось импортировать студентов"
      );
    } finally {
      setImportLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Загрузка студентов...</div>;
  }

  if (error) {
    return <div style={{ padding: 20, color: "red" }}>{error}</div>;
  }

  return (
    <div style={{ maxWidth: 980, margin: "40px auto" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link to="/">← На главную</Link>
        <Link to="/groups">← Назад к группам</Link>
        <Link to={`/groups/${id}/analytics`}>📊 Аналитика группы</Link>
      </div>

      <h1 style={{ marginBottom: 20 }}>Группа #{id}</h1>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Импорт студентов из Excel</h2>

        <p style={{ color: "#666" }}>
          Поддерживаются файлы <strong>.xlsx</strong> и <strong>.xls</strong>.
          Обязательные колонки: <code>full_name</code>, <code>email</code>.
          Необязательная колонка: <code>date_of_birth</code>.
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />

          <button onClick={handleImport} disabled={importLoading}>
            {importLoading ? "Импорт..." : "Импортировать"}
          </button>
        </div>

        {selectedFile && (
          <p style={{ marginTop: 12 }}>
            Выбран файл: <strong>{selectedFile.name}</strong>
          </p>
        )}

        {importError && (
          <div style={{ color: "red", marginTop: 12 }}>{importError}</div>
        )}

        {importResult && (
          <div style={{ marginTop: 16 }}>
            <div style={{ color: "green", marginBottom: 8 }}>
              Импорт завершён. Добавлено студентов:{" "}
              <strong>{importResult.imported_count}</strong>
            </div>

            {importResult.imported_students.length > 0 && (
              <div>
                <h3 style={{ marginBottom: 8 }}>Добавленные/обработанные студенты</h3>
                <ul style={{ marginTop: 0 }}>
                  {importResult.imported_students.map((student) => (
                    <li key={student.id}>
                      {student.last_name} {student.first_name}{" "}
                      {student.middle_name ?? ""} — {student.email}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Студенты группы</h2>

        {students.length === 0 ? (
          <p>В этой группе пока нет студентов</p>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              background: "white",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Фамилия</th>
                <th style={thStyle}>Имя</th>
                <th style={thStyle}>Отчество</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td style={tdStyle}>{student.id}</td>
                  <td style={tdStyle}>{student.last_name}</td>
                  <td style={tdStyle}>{student.first_name}</td>
                  <td style={tdStyle}>{student.middle_name ?? "-"}</td>
                  <td style={tdStyle}>{student.email}</td>
                  <td style={tdStyle}>
                    <Link to={`/students/${student.id}`}>Открыть</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 20,
  marginBottom: 20,
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