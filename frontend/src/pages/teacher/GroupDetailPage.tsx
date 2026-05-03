import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";
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

type Lesson = {
  id: number;
  title: string;
  lesson_date: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
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

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonType, setLessonType] = useState("Зачёт");
  const [lessonTopic, setLessonTopic] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [lessonStartTime, setLessonStartTime] = useState("09:00");
  const [lessonEndTime, setLessonEndTime] = useState("10:30");
  const [lessonLocation, setLessonLocation] = useState("");
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonError, setLessonError] = useState("");
  const [lessonSuccess, setLessonSuccess] = useState("");
  const [teacherId, setTeacherId] = useState<number | null>(null);

  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

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

  const fetchLessons = async () => {
    try {
      const res = await api.get<Lesson[]>(`/groups/${id}/lessons`);
      setLessons(res.data);
    } catch {
      setLessons([]);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchLessons();
    api.get<{ id: number }>("/auth/me").then((r) => setTeacherId(r.data.id)).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateLesson = async () => {
    if (!lessonDate) { setLessonError("Укажите дату мероприятия"); return; }
    if (!teacherId) { setLessonError("Не удалось определить ID преподавателя"); return; }

    const title = lessonTopic.trim() ? `${lessonType}: ${lessonTopic.trim()}` : lessonType;
    const startsAt = `${lessonDate}T${lessonStartTime}:00`;
    const endsAt = `${lessonDate}T${lessonEndTime}:00`;

    try {
      setLessonLoading(true);
      setLessonError("");
      setLessonSuccess("");
      await api.post("/lessons/", {
        group_id: Number(id),
        teacher_id: teacherId,
        title,
        lesson_date: lessonDate,
        starts_at: startsAt,
        ends_at: endsAt,
        location: lessonLocation.trim() || null,
      });
      setLessonSuccess("Мероприятие успешно создано");
      setLessonTopic("");
      setLessonDate("");
      setLessonLocation("");
      await fetchLessons();
    } catch (err: any) {
      setLessonError(err?.response?.data?.detail || "Не удалось создать мероприятие");
    } finally {
      setLessonLoading(false);
    }
  };

  const startEditing = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setEditTitle(lesson.title);
    setEditDate(lesson.lesson_date);
    setEditStartTime(lesson.starts_at.slice(11, 16));
    setEditEndTime(lesson.ends_at.slice(11, 16));
    setEditLocation(lesson.location ?? "");
    setEditError("");
  };

  const handleSaveEdit = async (lesson: Lesson) => {
    if (!editDate) { setEditError("Укажите дату"); return; }
    try {
      setEditLoading(true);
      setEditError("");
      const startsAt = `${editDate}T${editStartTime}:00`;
      const endsAt = `${editDate}T${editEndTime}:00`;
      await api.put(`/lessons/${lesson.id}`, {
        title: editTitle.trim() || lesson.title,
        lesson_date: editDate,
        starts_at: startsAt,
        ends_at: endsAt,
        location: editLocation.trim() || null,
      });
      setEditingLessonId(null);
      await fetchLessons();
    } catch (err: any) {
      setEditError(err?.response?.data?.detail || "Не удалось сохранить изменения");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId: number) => {
    if (!window.confirm("Удалить это мероприятие? Все связанные данные (посещаемость, метрики) будут удалены.")) return;
    try {
      setDeleteLoadingId(lessonId);
      await api.delete(`/lessons/${lessonId}`);
      await fetchLessons();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Не удалось удалить мероприятие");
    } finally {
      setDeleteLoadingId(null);
    }
  };

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
              <div style={{ marginBottom: 16 }}>
                <div style={infoLabelStyle}>Описание обязательных колонок:</div>
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: "30%" }}>Колонка</th>
                        <th style={thStyle}>Описание</th>
                        <th style={{ ...thStyle, width: "28%" }}>Пример значения</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { col: "full_name", desc: "Полное ФИО студента через пробел", example: "Иванов Иван Иванович" },
                        { col: "email", desc: "Email студента — используется как логин в системе", example: "ivanov@example.com" },
                        { col: "date_of_birth", desc: "Дата рождения в формате ДД.ММ.ГГГГ", example: "15.03.2002" },
                        { col: "group_name", desc: "Название учебной группы (должно совпадать с группой)", example: "ИС-203" },
                        { col: "subject_name", desc: "Название учебного предмета / дисциплины", example: "Математический анализ" },
                        { col: "total_classes", desc: "Общее количество занятий по предмету за период", example: "32" },
                        { col: "attended_classes", desc: "Сколько занятий студент фактически посетил", example: "28" },
                        { col: "excused_missed_classes", desc: "Пропуски по уважительной причине (справка, приказ)", example: "3" },
                        { col: "average_score", desc: "Средний балл студента по предмету (от 0 до 50)", example: "42.5" },
                        { col: "event_type", desc: "Тип мероприятия — необязательно, автоматически создаёт занятие", example: "Зачёт / Экзамен" },
                        { col: "event_name", desc: "Название мероприятия — если не указано, берётся subject_name", example: "Экзамен по математике" },
                      ].map(({ col, desc, example }) => (
                        <tr key={col}>
                          <td style={tdStyle}><span style={codeTagStyle}>{col}</span></td>
                          <td style={{ ...tdStyle, color: "#475569", fontSize: 13 }}>{desc}</td>
                          <td style={{ ...tdStyle, color: "#64748b", fontSize: 13, fontStyle: "italic" }}>{example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div style={infoLabelStyle}>При импорте система:</div>
                <ul style={checkListStyle}>
                  <li>Создаёт новых студентов и аккаунты для входа</li>
                  <li>Добавляет их в текущую группу</li>
                  <li>Сохраняет академические показатели (посещаемость, баллы)</li>
                  <li>Отправляет логин и пароль на указанный email</li>
                  <li>Если указан <strong>event_type</strong> (Зачёт / Экзамен) — автоматически создаёт мероприятие в группе</li>
                </ul>
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

          {/* Lesson creation card */}
          <div style={cardStyle}>
            <div style={cardHeaderRowStyle}>
              <div style={lessonIconStyle}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h2 style={sectionTitleStyle}>Создать мероприятие</h2>
                <p style={sectionSubtitleStyle}>Добавьте учебное мероприятие для видеоанализа вовлечённости</p>
              </div>
            </div>

            <div style={lessonFormGridStyle}>
              <div>
                <label style={fieldLabelStyle}>Тип мероприятия</label>
                <select
                  style={inputStyle}
                  value={lessonType}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setLessonType(e.target.value)}
                >
                  <option value="Зачёт">Зачёт</option>
                  <option value="Экзамен">Экзамен</option>
                </select>
              </div>
              <div>
                <label style={fieldLabelStyle}>Тема / предмет (необязательно)</label>
                <input
                  style={inputStyle}
                  type="text"
                  placeholder="Например, по математическому анализу"
                  value={lessonTopic}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setLessonTopic(e.target.value)}
                />
              </div>
              <div>
                <label style={fieldLabelStyle}>Дата</label>
                <input style={inputStyle} type="date" value={lessonDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setLessonDate(e.target.value)} />
              </div>
              <div>
                <label style={fieldLabelStyle}>Начало</label>
                <input style={inputStyle} type="time" value={lessonStartTime} onChange={(e: ChangeEvent<HTMLInputElement>) => setLessonStartTime(e.target.value)} />
              </div>
              <div>
                <label style={fieldLabelStyle}>Конец</label>
                <input style={inputStyle} type="time" value={lessonEndTime} onChange={(e: ChangeEvent<HTMLInputElement>) => setLessonEndTime(e.target.value)} />
              </div>
              <div>
                <label style={fieldLabelStyle}>Аудитория (необязательно)</label>
                <input style={inputStyle} type="text" placeholder="Например, 301-А" value={lessonLocation} onChange={(e: ChangeEvent<HTMLInputElement>) => setLessonLocation(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <button onClick={handleCreateLesson} disabled={lessonLoading} style={lessonBtnStyle}>
                {lessonLoading ? "Создание..." : "Создать мероприятие"}
              </button>
            </div>

            {lessonError && <div style={inlineErrorStyle}>{lessonError}</div>}
            {lessonSuccess && <div style={inlineSuccessStyle}>{lessonSuccess}</div>}

            {lessons.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Мероприятия группы ({lessons.length})
                </div>
                {editError && <div style={{ ...inlineErrorStyle, marginBottom: 10 }}>{editError}</div>}
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={{ ...thStyle, width: 48 }}>ID</th>
                        <th style={thStyle}>Название</th>
                        <th style={thStyle}>Дата</th>
                        <th style={thStyle}>Время</th>
                        <th style={thStyle}>Аудитория</th>
                        <th style={{ ...thStyle, width: 140 }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lessons.map((lesson) =>
                        editingLessonId === lesson.id ? (
                          <tr key={lesson.id} style={{ background: "#f0f7ff" }}>
                            <td style={{ ...tdStyle, color: "#94a3b8", fontWeight: 700 }}>#{lesson.id}</td>
                            <td style={tdStyle}>
                              <input
                                style={{ ...editInputStyle, width: "100%" }}
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <input
                                style={editInputStyle}
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input style={{ ...editInputStyle, width: 80 }} type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                                <span style={{ color: "#94a3b8" }}>—</span>
                                <input style={{ ...editInputStyle, width: 80 }} type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <input
                                style={editInputStyle}
                                type="text"
                                placeholder="Аудитория"
                                value={editLocation}
                                onChange={(e) => setEditLocation(e.target.value)}
                              />
                            </td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button
                                  onClick={() => handleSaveEdit(lesson)}
                                  disabled={editLoading}
                                  style={saveBtnStyle}
                                >
                                  {editLoading ? "..." : "Сохранить"}
                                </button>
                                <button
                                  onClick={() => setEditingLessonId(null)}
                                  style={cancelBtnStyle}
                                >
                                  Отмена
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={lesson.id}>
                            <td style={{ ...tdStyle, color: "#94a3b8", fontWeight: 700 }}>#{lesson.id}</td>
                            <td style={{ ...tdStyle, fontWeight: 600 }}>{lesson.title}</td>
                            <td style={tdStyle}>{new Date(lesson.lesson_date).toLocaleDateString("ru-RU")}</td>
                            <td style={{ ...tdStyle, color: "#64748b" }}>
                              {lesson.starts_at.slice(11, 16)} — {lesson.ends_at.slice(11, 16)}
                            </td>
                            <td style={{ ...tdStyle, color: "#64748b" }}>{lesson.location ?? "—"}</td>
                            <td style={tdStyle}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => startEditing(lesson)} style={editBtnStyle}>Изменить</button>
                                <button
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                  disabled={deleteLoadingId === lesson.id}
                                  style={deleteBtnStyle}
                                >
                                  {deleteLoadingId === lesson.id ? "..." : "Удалить"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
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

const lessonIconStyle: CSSProperties = {
  width: 50, height: 50, borderRadius: 14, flexShrink: 0,
  background: "linear-gradient(135deg, #2563eb, #6366f1)",
  display: "flex", alignItems: "center", justifyContent: "center",
  boxShadow: "0 4px 12px rgba(37,99,235,0.28)",
};
const lessonFormGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 14,
};
const fieldLabelStyle: CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%", padding: "11px 14px", border: "1.5px solid #e2e8f0",
  borderRadius: 12, fontSize: 14, color: "#0f172a", background: "#f8fafc",
  boxSizing: "border-box",
};
const lessonBtnStyle: CSSProperties = {
  padding: "11px 22px", borderRadius: 12, border: "none",
  background: "linear-gradient(135deg, #2563eb, #3b82f6)",
  color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
  boxShadow: "0 3px 10px rgba(37,99,235,0.28)",
};
const inlineSuccessStyle: CSSProperties = {
  marginTop: 12, padding: "10px 14px", borderRadius: 10,
  background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 13, fontWeight: 600,
};
const editBtnStyle: CSSProperties = {
  padding: "4px 12px", borderRadius: 8, border: "1.5px solid #dbeafe",
  background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const deleteBtnStyle: CSSProperties = {
  padding: "4px 12px", borderRadius: 8, border: "1.5px solid #fecaca",
  background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const saveBtnStyle: CSSProperties = {
  padding: "4px 12px", borderRadius: 8, border: "none",
  background: "linear-gradient(135deg, #059669, #10b981)",
  color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer",
};
const cancelBtnStyle: CSSProperties = {
  padding: "4px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0",
  background: "#f8fafc", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
const editInputStyle: CSSProperties = {
  padding: "5px 10px", border: "1.5px solid #cbd5e1",
  borderRadius: 8, fontSize: 13, color: "#0f172a", background: "white",
  boxSizing: "border-box",
};
