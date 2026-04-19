import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties } from "react";

type Student = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  role: "student" | "teacher" | "admin";
};

type AcademicSnapshotImportItem = {
  student_id: number;
  email: string;
  full_name: string;
  group_name: string;
  subject_name: string;
  total_classes: number;
  attended_classes: number;
  excused_missed_classes: number;
  average_score: number;
};

type AcademicSnapshotImportResponse = {
  imported_count: number;
  created_students_count: number;
  created_groups_count: number;
  processed_items: AcademicSnapshotImportItem[];
};

export default function GroupDetailPage() {
  const { id } = useParams();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<AcademicSnapshotImportResponse | null>(null);

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

  const handleAcademicImport = async () => {
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

      const res = await api.post<AcademicSnapshotImportResponse>(
        `/groups/${id}/import-academic-snapshots`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setImportResult(res.data);
      setSelectedFile(null);
      await fetchStudents();
    } catch (err: any) {
      setImportError(
        err?.response?.data?.detail || "Не удалось импортировать академические данные"
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
    <div style={{ maxWidth: 1100, margin: "40px auto" }}>
      <div style={{ marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link to="/teacher">← На главную</Link>
        <Link to="/groups">← Назад к группам</Link>
        <Link to={`/groups/${id}/analytics`}>📊 Аналитика группы</Link>
      </div>

      <h1 style={{ marginBottom: 20 }}>Группа #{id}</h1>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Импорт академических данных из Excel</h2>

        <p style={{ color: "#666", lineHeight: 1.6 }}>
          Поддерживаются файлы <strong>.xlsx</strong> и <strong>.xls</strong>.
          <br />
          Обязательные колонки:
          {" "}
          <code>full_name</code>, <code>email</code>, <code>date_of_birth</code>,{" "}
          <code>group_name</code>, <code>subject_name</code>, <code>total_classes</code>,{" "}
          <code>attended_classes</code>, <code>excused_missed_classes</code>,{" "}
          <code>average_score</code>.
          <br />
          При импорте система:
          <br />— создаёт новых студентов
          <br />— добавляет их в текущую группу
          <br />— сохраняет учебные показатели
          <br />— отправляет новым студентам логин и пароль на почту
        </p>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />

          <button onClick={handleAcademicImport} disabled={importLoading}>
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
              Импорт завершён успешно
            </div>

            <div style={{ marginBottom: 12 }}>
              Обработано строк: <strong>{importResult.imported_count}</strong>
              <br />
              Создано новых студентов: <strong>{importResult.created_students_count}</strong>
            </div>

            {importResult.processed_items.length > 0 && (
              <div>
                <h3 style={{ marginBottom: 8 }}>Обработанные данные</h3>

                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Студент</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Предмет</th>
                      <th style={thStyle}>Всего занятий</th>
                      <th style={thStyle}>Посещено</th>
                      <th style={thStyle}>Уваж. пропуски</th>
                      <th style={thStyle}>Средний балл</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.processed_items.map((item, index) => (
                      <tr key={`${item.student_id}-${index}`}>
                        <td style={tdStyle}>{item.full_name}</td>
                        <td style={tdStyle}>{item.email}</td>
                        <td style={tdStyle}>{item.subject_name}</td>
                        <td style={tdStyle}>{item.total_classes}</td>
                        <td style={tdStyle}>{item.attended_classes}</td>
                        <td style={tdStyle}>{item.excused_missed_classes}</td>
                        <td style={tdStyle}>{item.average_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  background: "white",
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