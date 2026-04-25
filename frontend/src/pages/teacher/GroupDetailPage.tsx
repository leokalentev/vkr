import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties } from "react";
import AppShell from "../../components/layout/AppShell";

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

const teacherLinks = [
  { label: "Главная", to: "/teacher" },
  { label: "Группы", to: "/groups" },
];

export default function GroupDetailPage() {
  const { id } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => { fetchStudents(); }, [id]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setImportError("");
    setImportResult(null);
  };

  const handleAcademicImport = async () => {
    if (!selectedFile) { setImportError("Сначала выберите Excel-файл"); return; }
    const formData = new FormData();
    formData.append("file", selectedFile);
    try {
      setImportLoading(true);
      setImportError("");
      setImportResult(null);
      const res = await api.post<AcademicSnapshotImportResponse>(
        `/groups/${id}/import-academic-snapshots`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setImportResult(res.data);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchStudents();
    } catch (err: any) {
      setImportError(err?.response?.data?.detail || "Не удалось импортировать данные");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <AppShell
      sidebarTitle="Преподаватель"
      sidebarLinks={teacherLinks}
      pageTitle={`Группа #${id}`}
      pageSubtitle="Управление студентами и импорт академических данных"
    >
      {/* Breadcrumb */}
      <div style={breadcrumbStyle}>
        <Link to="/teacher" style={breadcrumbLinkStyle}>Главная</Link>
        <span style={breadcrumbSepStyle}>/</span>
        <Link to="/groups" style={breadcrumbLinkStyle}>Группы</Link>
        <span style={breadcrumbSepStyle}>/</span>
        <span style={breadcrumbCurrentStyle}>Группа #{id}</span>
        <Link to={`/groups/${id}/analytics`} style={{ ...breadcrumbLinkStyle, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Аналитика группы
        </Link>
      </div>

      {loading ? (
        <div style={loadingStyle}>
          <div style={spinnerStyle} />
          Загрузка студентов...
        </div>
      ) : error ? (
        <div style={errorBoxStyle}>{error}</div>
      ) : (
        <>
          {/* Import card */}
          <div style={cardStyle}>
            <div style={cardHeaderRowStyle}>
              <div style={importIconStyle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
              </div>
              <div>
                <h2 style={sectionTitleStyle}>Импорт из Excel</h2>
                <p style={sectionSubtitleStyle}>Загрузите .xlsx или .xls файл с академическими данными</p>
              </div>
            </div>

            {/* Info block */}
            <div style={infoBlockStyle}>
              <div style={infoBlockTitleStyle}>Требования к файлу</div>
              <div style={columnsGridStyle}>
                <div>
                  <div style={infoLabelStyle}>Обязательные колонки:</div>
                  <div style={codeListStyle}>
                    {["full_name", "email", "date_of_birth", "group_name", "subject_name",
                      "total_classes", "attended_classes", "excused_missed_classes", "average_score"
                    ].map((col) => (
                      <span key={col} style={codeTagStyle}>{col}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={infoLabelStyle}>При импорте система:</div>
                  <ul style={checkListStyle}>
                    <li>Создаёт новых студентов</li>
                    <li>Добавляет их в текущую группу</li>
                    <li>Сохраняет учебные показатели</li>
                    <li>Отправляет логин и пароль на почту</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* File upload */}
            <div style={uploadRowStyle}>
              <div
                style={fileDropStyle}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ fontSize: 14, color: "#64748b" }}>
                  {selectedFile ? (
                    <span style={{ color: "#2563eb", fontWeight: 600 }}>{selectedFile.name}</span>
                  ) : (
                    "Нажмите, чтобы выбрать файл"
                  )}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
              </div>
              <button
                onClick={handleAcademicImport}
                disabled={importLoading || !selectedFile}
                style={importBtnStyle}
              >
                {importLoading ? "Импорт..." : "Импортировать"}
              </button>
            </div>

            {importError && <div style={inlineErrorStyle}>{importError}</div>}

            {importResult && (
              <div style={importResultStyle}>
                <div style={importResultHeaderStyle}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Импорт завершён успешно
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 16 }}>
                  <div style={resultStatStyle}>
                    <span style={resultStatValueStyle}>{importResult.imported_count}</span>
                    <span style={resultStatLabelStyle}>строк обработано</span>
                  </div>
                  <div style={resultStatStyle}>
                    <span style={{ ...resultStatValueStyle, color: "#2563eb" }}>{importResult.created_students_count}</span>
                    <span style={resultStatLabelStyle}>новых студентов</span>
                  </div>
                </div>

                {importResult.processed_items.length > 0 && (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Студент</th>
                          <th style={thStyle}>Email</th>
                          <th style={thStyle}>Предмет</th>
                          <th style={thStyle}>Всего</th>
                          <th style={thStyle}>Посещено</th>
                          <th style={thStyle}>Уваж.</th>
                          <th style={thStyle}>Балл</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.processed_items.map((item, i) => (
                          <tr key={`${item.student_id}-${i}`}>
                            <td style={tdStyle}><span style={{ fontWeight: 600 }}>{item.full_name}</span></td>
                            <td style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}>{item.email}</td>
                            <td style={tdStyle}>{item.subject_name}</td>
                            <td style={tdStyle}>{item.total_classes}</td>
                            <td style={tdStyle}>
                              <span style={badgeGreenStyle}>{item.attended_classes}</span>
                            </td>
                            <td style={tdStyle}>{item.excused_missed_classes}</td>
                            <td style={tdStyle}>
                              <span style={badgeBlueStyle}>{item.average_score}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Students table */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={sectionTitleStyle}>Студенты группы</h2>
                <p style={sectionSubtitleStyle}>
                  {students.length === 0 ? "В группе пока нет студентов" : `${students.length} студент${students.length === 1 ? "" : students.length < 5 ? "а" : "ов"}`}
                </p>
              </div>
            </div>

            {students.length === 0 ? (
              <div style={emptyStyle}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12 }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
                <div style={{ color: "#94a3b8", fontSize: 14 }}>Импортируйте данные из Excel, чтобы добавить студентов</div>
              </div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Студент</th>
                      <th style={thStyle}>Email</th>
                      <th style={thStyle}>Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id}>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={avatarSmallStyle}>
                              {student.first_name[0]}{student.last_name[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                                {student.last_name} {student.first_name}
                              </div>
                              {student.middle_name && (
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>{student.middle_name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, color: "#64748b", fontSize: 13 }}>{student.email}</td>
                        <td style={tdStyle}>
                          <Link to={`/students/${student.id}`} style={linkBtnStyle}>
                            Открыть профиль →
                          </Link>
                        </td>
                      </tr>
                    ))}
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
const breadcrumbStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontSize: 13, color: "#64748b", flexWrap: "wrap",
};
const breadcrumbLinkStyle: CSSProperties = {
  color: "#2563eb", textDecoration: "none", fontWeight: 500,
};
const breadcrumbSepStyle: CSSProperties = { color: "#cbd5e1" };
const breadcrumbCurrentStyle: CSSProperties = { color: "#0f172a", fontWeight: 700 };

const loadingStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 12,
  padding: "40px 20px", color: "#64748b", fontSize: 15,
};
const spinnerStyle: CSSProperties = {
  width: 20, height: 20,
  border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb",
  borderRadius: "50%", animation: "spin 0.8s linear infinite",
};
const errorBoxStyle: CSSProperties = {
  padding: "16px 20px", borderRadius: 12,
  background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14,
};
const cardStyle: CSSProperties = {
  background: "white", border: "1px solid #e2e8f0", borderRadius: 20,
  padding: "22px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
};
const cardHeaderRowStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 14, marginBottom: 18,
};
const importIconStyle: CSSProperties = {
  width: 50, height: 50, borderRadius: 14, flexShrink: 0,
  background: "linear-gradient(135deg, #059669, #10b981)",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 4px 12px rgba(5,150,105,0.28)",
};
const sectionTitleStyle: CSSProperties = {
  fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4,
};
const sectionSubtitleStyle: CSSProperties = {
  fontSize: 13, color: "#64748b",
};
const infoBlockStyle: CSSProperties = {
  background: "#f8fafc", border: "1px solid #e2e8f0",
  borderRadius: 14, padding: "16px 18px", marginBottom: 18,
};
const infoBlockTitleStyle: CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12,
};
const columnsGridStyle: CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20,
};
const infoLabelStyle: CSSProperties = {
  fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 600,
};
const codeListStyle: CSSProperties = {
  display: "flex", flexWrap: "wrap", gap: 6,
};
const codeTagStyle: CSSProperties = {
  background: "#e0e7ff", color: "#4338ca",
  borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
  fontFamily: "ui-monospace, Consolas, monospace",
};
const checkListStyle: CSSProperties = {
  margin: 0, paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.8,
};
const uploadRowStyle: CSSProperties = {
  display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap",
};
const fileDropStyle: CSSProperties = {
  flex: 1, minWidth: 220,
  display: "flex", alignItems: "center", gap: 10,
  padding: "12px 16px", borderRadius: 12,
  border: "1.5px dashed #cbd5e1", background: "#f8fafc",
  cursor: "pointer",
};
const importBtnStyle: CSSProperties = {
  padding: "12px 22px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #059669, #10b981)",
  color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
  boxShadow: "0 3px 10px rgba(5,150,105,0.3)", flexShrink: 0,
};
const inlineErrorStyle: CSSProperties = {
  marginTop: 12, padding: "10px 14px", borderRadius: 10,
  background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13,
};
const importResultStyle: CSSProperties = {
  marginTop: 16, padding: "16px 18px", borderRadius: 14,
  background: "#f0fdf4", border: "1px solid #bbf7d0",
};
const importResultHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  fontWeight: 700, color: "#16a34a", fontSize: 15, marginBottom: 14,
};
const resultStatStyle: CSSProperties = {
  display: "flex", flexDirection: "column", gap: 2,
};
const resultStatValueStyle: CSSProperties = {
  fontSize: 26, fontWeight: 800, color: "#16a34a", lineHeight: 1,
};
const resultStatLabelStyle: CSSProperties = {
  fontSize: 12, color: "#64748b",
};
const tableWrapStyle: CSSProperties = {
  overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14,
};
const tableStyle: CSSProperties = {
  width: "100%", borderCollapse: "separate", borderSpacing: 0,
};
const thStyle: CSSProperties = {
  textAlign: "left", padding: "11px 16px",
  background: "#f8fafc", color: "#475569",
  fontWeight: 600, fontSize: 12,
  letterSpacing: "0.5px", textTransform: "uppercase",
  borderBottom: "1px solid #e2e8f0",
};
const tdStyle: CSSProperties = {
  padding: "13px 16px", borderBottom: "1px solid #f1f5f9",
  color: "#334155", fontSize: 14,
};
const emptyStyle: CSSProperties = {
  padding: "40px 0", textAlign: "center", display: "flex",
  flexDirection: "column", alignItems: "center",
};
const avatarSmallStyle: CSSProperties = {
  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
  background: "linear-gradient(135deg, #2563eb, #6366f1)",
  color: "white", display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 700, fontSize: 13,
};
const linkBtnStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "5px 12px", borderRadius: 8,
  fontSize: 13, fontWeight: 600,
  background: "#eff6ff", color: "#2563eb",
  textDecoration: "none", border: "1px solid #dbeafe",
};
const badgeGreenStyle: CSSProperties = {
  display: "inline-flex", padding: "3px 10px",
  borderRadius: 999, fontSize: 12, fontWeight: 600,
  background: "#dcfce7", color: "#16a34a",
};
const badgeBlueStyle: CSSProperties = {
  display: "inline-flex", padding: "3px 10px",
  borderRadius: 999, fontSize: 12, fontWeight: 600,
  background: "#dbeafe", color: "#1d4ed8",
};
