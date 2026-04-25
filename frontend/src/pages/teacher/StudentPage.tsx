import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";
import AppShell from "../../components/layout/AppShell";

type StudentShortRead = {
  id: number; email: string; first_name: string; last_name: string; middle_name: string | null; role: string;
};
type GroupShortRead = { id: number; name: string; curator_id: number | null };
type StudentAnalyticsSummary = {
  student: StudentShortRead; groups: GroupShortRead[];
  total_attendance_records: number; attended_records: number;
  attendance_rate_percent: number | null; attendance_score: number | null;
  total_assessment_results: number; average_academic_score: number | null;
  total_engagement_metrics: number; average_engagement_index: number | null;
  integral_engagement_score: number | null; engagement_level: string;
  component_weights: { base_weights?: Record<string, number>; normalized_weights?: Record<string, number> };
};
type Recommendation = {
  id: number; student_id: number; lesson_id: number | null;
  recommendation_type: "academic" | "activity" | "risk" | "motivation";
  title: string; text: string; confidence_score: number | null; is_read: boolean; created_at: string;
};
type LessonShortRead = {
  id: number; group_id: number; teacher_id: number; title: string;
  lesson_date: string; starts_at: string; ends_at: string; location: string | null; description: string | null;
};
type VideoAnalysisResponse = {
  attendance: { id: number; lesson_id: number; student_id: number; status: string; detected_by_cv: boolean; confidence: number | null; created_at: string };
  engagement_metric: {
    id: number; lesson_id: number; student_id: number; presence_ratio: number;
    face_match_confidence: number | null; head_pose_forward_ratio: number;
    head_pose_variance: number; motion_level: number; frame_stability: number;
    grade_score: number | null; engagement_index: number; frame_count: number | null;
    model_name: string | null; model_version: string | null;
    weights_json?: Record<string, unknown> | null; computed_at: string;
  };
  meta: { processed_frames: number; detected_faces: number; matched_faces: number; pose_detected_frames: number; video_path: string; template_path: string };
};

const interpretationRows = [
  { name: "Посещаемость", meaning: "Показывает, был ли студент реально зафиксирован на контрольном мероприятии.", effect: "Влияет на общий уровень участия студента в образовательном процессе." },
  { name: "Учебный результат", meaning: "Отражает качество выполнения задания или контрольной работы.", effect: "Позволяет оценить академическую успешность студента." },
  { name: "Индекс вовлечённости", meaning: "Объединяет поведенческие признаки: присутствие, внимание, устойчивость и активность.", effect: "Показывает, насколько студент был включён в процесс во время мероприятия." },
  { name: "Интегральный индекс", meaning: "Итоговый показатель, объединяющий посещаемость, учебный результат и вовлечённость.", effect: "Используется системой для общего вывода и рекомендаций преподавателю." },
];

const teacherLinks = [
  { label: "Главная", to: "/teacher" },
  { label: "Группы", to: "/groups" },
];

function fmtV(v: number | null, digits = 4) {
  if (v === null || v === undefined) return "—";
  return v.toFixed(digits);
}
function fmtPct(v: number | null) {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(2)}%`;
}
function getEngagementLabel(v: number) {
  if (v >= 0.85) return "Высокая";
  if (v >= 0.7) return "Хорошая";
  if (v >= 0.5) return "Средняя";
  return "Низкая";
}
function translateEngagementLevel(level: string) {
  const map: Record<string, string> = { high: "Высокий", good: "Хороший", medium: "Средний", low: "Низкий", insufficient_data: "Недостаточно данных" };
  return map[level] || level;
}
function translateRecType(type: string) {
  const map: Record<string, string> = { academic: "Учебная поддержка", activity: "Активность", risk: "Риск", motivation: "Мотивация" };
  return map[type] || type;
}
function engagementLevelColor(level: string): { bg: string; color: string } {
  const m: Record<string, { bg: string; color: string }> = {
    high: { bg: "#dcfce7", color: "#16a34a" }, good: { bg: "#d1fae5", color: "#059669" },
    medium: { bg: "#fef9c3", color: "#ca8a04" }, low: { bg: "#fee2e2", color: "#dc2626" },
  };
  return m[level] ?? { bg: "#f1f5f9", color: "#64748b" };
}
function recTypeColor(type: string): { bg: string; color: string } {
  const m: Record<string, { bg: string; color: string }> = {
    academic: { bg: "#dbeafe", color: "#1d4ed8" }, activity: { bg: "#d1fae5", color: "#059669" },
    risk: { bg: "#fee2e2", color: "#dc2626" }, motivation: { bg: "#ede9fe", color: "#7c3aed" },
  };
  return m[type] ?? { bg: "#f1f5f9", color: "#64748b" };
}

function MetricCard({ label, value, digits = 4, hint }: { label: string; value: number | null; digits?: number; hint?: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, lineHeight: 1.4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: hint ? 8 : 0 }}>{fmtV(value, digits)}</div>
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}

export default function StudentPage() {
  const { id } = useParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [data, setData] = useState<StudentAnalyticsSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [lessons, setLessons] = useState<LessonShortRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const [error, setError] = useState("");
  const [recError, setRecError] = useState("");

  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisSuccess, setAnalysisSuccess] = useState("");
  const [analysisResult, setAnalysisResult] = useState<VideoAnalysisResponse | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedFileName, setRecordedFileName] = useState("");

  useEffect(() => {
    if (!analysisLoading) return;
    const t = window.setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => window.clearInterval(t);
  }, [analysisLoading]);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecordingSeconds((p) => p + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  useEffect(() => { return () => stopCameraTracks(); }, []);

  const loadRecommendations = async () => {
    try {
      const res = await api.get(`/students/${id}/recommendations`);
      setRecommendations(res.data); setRecError("");
    } catch { setRecError("Не удалось загрузить рекомендации"); }
  };
  const loadLessons = async () => {
    try {
      const res = await api.get<LessonShortRead[]>(`/students/${id}/lessons`);
      setLessons(res.data);
      if (res.data.length > 0 && !selectedLessonId) setSelectedLessonId(String(res.data[0].id));
    } catch { setLessons([]); }
  };
  const loadStudentAnalytics = async () => {
    const res = await api.get<StudentAnalyticsSummary>(`/students/${id}/analytics-summary`);
    setData(res.data);
  };
  const loadAll = async () => {
    try { setLoading(true); setError(""); await Promise.all([loadStudentAnalytics(), loadRecommendations(), loadLessons()]); }
    catch { setError("Не удалось загрузить аналитику студента"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [id]);// eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerateRecommendations = async () => {
    try { setRecLoading(true); setRecError(""); await api.post(`/students/${id}/generate-recommendations`); await loadRecommendations(); }
    catch { setRecError("Не удалось сгенерировать рекомендации"); }
    finally { setRecLoading(false); }
  };
  const handleMarkAsRead = async (recId: number) => {
    try { await api.patch(`/recommendations/${recId}/read`); await loadRecommendations(); }
    catch { setRecError("Не удалось отметить рекомендацию как прочитанную"); }
  };
  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedVideo(e.target.files?.[0] ?? null); setRecordedBlob(null); setRecordedFileName(""); setAnalysisError(""); setAnalysisSuccess("");
  };
  const stopCameraTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraEnabled(false);
  };
  const handleEnableCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraEnabled(true);
    } catch { setCameraError("Не удалось получить доступ к камере или микрофону"); setCameraEnabled(false); }
  };
  const handleDisableCamera = () => { if (recording) handleStopRecording(); stopCameraTracks(); };
  const getSupportedMimeType = () => {
    for (const m of ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"])
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
    return "";
  };
  const handleStartRecording = () => {
    if (!streamRef.current) { setCameraError("Сначала включите камеру"); return; }
    try {
      recordedChunksRef.current = []; setRecordedBlob(null); setRecordedFileName(""); setRecordingSeconds(0); setAnalysisError(""); setAnalysisSuccess("");
      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(streamRef.current, { mimeType }) : new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e: BlobEvent) => { if (e.data?.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const mt = recorder.mimeType || "video/webm";
        setRecordedBlob(new Blob(recordedChunksRef.current, { type: mt }));
        setRecordedFileName(`live_recording_student_${id}.${mt.includes("webm") ? "webm" : "mp4"}`);
      };
      recorder.start(); setRecording(true);
    } catch { setCameraError("Не удалось начать запись видео"); setRecording(false); }
  };
  const handleStopRecording = () => {
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    setRecording(false);
  };
  const runAnalysis = async (fileToSend: File) => {
    if (!id) return;
    if (!selectedLessonId) { setAnalysisError("Выберите мероприятие"); setAnalysisSuccess(""); return; }
    try {
      setAnalysisLoading(true); setElapsedSeconds(0); setAnalysisError(""); setAnalysisSuccess(""); setAnalysisResult(null); setShowTechnicalDetails(false);
      const fd = new FormData(); fd.append("lesson_id", selectedLessonId); fd.append("student_id", id); fd.append("file", fileToSend);
      const res = await api.post<VideoAnalysisResponse>("/cv/analyze-video", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setAnalysisResult(res.data); setAnalysisSuccess("Видео успешно обработано, результаты сохранены");
      await Promise.all([loadStudentAnalytics(), loadRecommendations()]);
    } catch (err: any) {
      setAnalysisError(err?.response?.data?.detail || "Не удалось выполнить анализ видео"); setAnalysisSuccess("");
    } finally { setAnalysisLoading(false); }
  };
  const handleAnalyzeUploadedVideo = async () => {
    if (!selectedVideo) { setAnalysisError("Сначала выберите видеофайл"); return; }
    await runAnalysis(selectedVideo);
  };
  const handleAnalyzeRecordedVideo = async () => {
    if (!recordedBlob || !recordedFileName) { setAnalysisError("Сначала запишите и остановите видео"); return; }
    await runAnalysis(new File([recordedBlob], recordedFileName, { type: recordedBlob.type || "video/webm" }));
  };

  const analysisDurationText = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60), s = elapsedSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsedSeconds]);
  const recordingDurationText = useMemo(() => {
    const m = Math.floor(recordingSeconds / 60), s = recordingSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [recordingSeconds]);

  const studentName = data ? [data.student.last_name, data.student.first_name, data.student.middle_name].filter(Boolean).join(" ") : "";
  const initials = data ? `${data.student.first_name[0] ?? ""}${data.student.last_name[0] ?? ""}`.toUpperCase() : "?";
  const levelColor = data ? engagementLevelColor(data.engagement_level) : { bg: "#f1f5f9", color: "#64748b" };

  return (
    <AppShell
      sidebarTitle="Преподаватель"
      sidebarLinks={teacherLinks}
      pageTitle={loading ? "Профиль студента" : studentName}
      pageSubtitle="Аналитика вовлечённости, видеомониторинг и рекомендации"
    >
      {/* Breadcrumb */}
      <div style={breadcrumbStyle}>
        <Link to="/teacher" style={bLink}>Главная</Link><span style={bSep}>/</span>
        <Link to="/groups" style={bLink}>Группы</Link><span style={bSep}>/</span>
        <span style={{ color: "#0f172a", fontWeight: 700 }}>Профиль студента</span>
      </div>

      {loading ? (
        <div style={loadingStyle}><div style={spinnerStyle} />Загрузка аналитики...</div>
      ) : error ? (
        <div style={errStyle}>{error}</div>
      ) : !data ? (
        <div style={errStyle}>Нет данных</div>
      ) : (
        <>
          {/* Hero profile */}
          <div style={heroCardStyle}>
            <div style={heroAvatarStyle}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>{studentName}</h2>
              <p style={{ fontSize: 14, color: "#64748b" }}>{data.student.email}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {data.groups.map((g) => (
                  <span key={g.id} style={groupTagStyle}>{g.name}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              <span style={{ display: "inline-flex", padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: levelColor.bg, color: levelColor.color }}>
                {translateEngagementLevel(data.engagement_level)}
              </span>
              <div style={{ fontSize: 13, color: "#64748b" }}>Интегральный: <strong style={{ color: "#0f172a" }}>{fmtV(data.integral_engagement_score)}</strong></div>
            </div>
          </div>

          {/* Stat cards */}
          <div style={grid3Style}>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Посещаемость</div>
              <div style={statValueStyle}>{fmtPct(data.attendance_rate_percent)}</div>
              <div style={statHintStyle}>{data.attended_records} из {data.total_attendance_records} занятий · индекс {fmtV(data.attendance_score)}</div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Учебный результат</div>
              <div style={statValueStyle}>{fmtV(data.average_academic_score)}</div>
              <div style={statHintStyle}>Всего оценок: {data.total_assessment_results}</div>
            </div>
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Индекс вовлечённости</div>
              <div style={statValueStyle}>{fmtV(data.average_engagement_index)}</div>
              <div style={statHintStyle}>Всего метрик: {data.total_engagement_metrics}</div>
            </div>
          </div>

          {/* Video monitoring */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={videoIconStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <h2 style={sectionTitleStyle}>Видеомониторинг</h2>
                <p style={sectionSubtitleStyle}>Анализ вовлечённости через камеру или загрузку видео</p>
              </div>
            </div>

            {/* Lesson selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Мероприятие</label>
              <select value={selectedLessonId} onChange={(e) => setSelectedLessonId(e.target.value)} style={selectStyle}>
                <option value="">— Выберите мероприятие —</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>#{l.id} — {l.title} ({l.lesson_date})</option>
                ))}
              </select>
            </div>

            {/* Camera section */}
            <div style={subSectionStyle}>
              <div style={subSectionTitleStyle}>Запись с камеры</div>
              <video ref={videoRef} autoPlay muted playsInline style={videoPreviewStyle} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                {!cameraEnabled ? (
                  <button onClick={handleEnableCamera} style={btnPrimaryStyle}>Включить камеру</button>
                ) : (
                  <button onClick={handleDisableCamera} style={btnDangerStyle}>Выключить камеру</button>
                )}
                {cameraEnabled && !recording && (
                  <button onClick={handleStartRecording} style={btnGreenStyle}>Начать запись</button>
                )}
                {cameraEnabled && recording && (
                  <button onClick={handleStopRecording} style={btnDangerStyle}>Остановить запись</button>
                )}
                {recordedBlob && !recording && (
                  <button onClick={handleAnalyzeRecordedVideo} disabled={analysisLoading} style={btnPrimaryStyle}>
                    {analysisLoading ? `Анализ... ${analysisDurationText}` : "Проанализировать запись"}
                  </button>
                )}
              </div>
              {cameraError && <div style={inlineErrStyle}>{cameraError}</div>}
              {recording && (
                <div style={recordingBoxStyle}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", display: "inline-block", marginRight: 8 }} />
                  Идёт запись: <strong>{recordingDurationText}</strong>
                </div>
              )}
              {recordedBlob && !recording && (
                <div style={successBoxStyle}>Запись завершена. Видео готово к анализу.</div>
              )}
            </div>

            {/* Divider */}
            <div style={divStyle} />

            {/* Upload section */}
            <div style={subSectionStyle}>
              <div style={subSectionTitleStyle}>Загрузить готовое видео</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch" }}>
                <div style={fileDropStyle} onClick={() => fileInputRef.current?.click()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span style={{ fontSize: 14, color: selectedVideo ? "#2563eb" : "#64748b", fontWeight: selectedVideo ? 600 : 400 }}>
                    {selectedVideo ? selectedVideo.name : "Выберите видеофайл"}
                  </span>
                  <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoChange} style={{ display: "none" }} />
                </div>
                <button onClick={handleAnalyzeUploadedVideo} disabled={analysisLoading || !selectedVideo} style={btnGreenStyle}>
                  {analysisLoading ? `Анализ... ${analysisDurationText}` : "Запустить анализ"}
                </button>
              </div>
            </div>

            {analysisLoading && (
              <div style={progressBoxStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={spinnerStyle} />
                  <span style={{ fontWeight: 700, color: "#1d4ed8" }}>Выполняется анализ видео</span>
                </div>
                <div style={{ fontSize: 14, color: "#64748b" }}>Прошло: <strong>{analysisDurationText}</strong> · Обычно занимает 3–5 минут</div>
              </div>
            )}
            {analysisError && <div style={inlineErrStyle}>{analysisError}</div>}
            {analysisSuccess && <div style={inlineSuccessStyle}>{analysisSuccess}</div>}

            {/* Analysis result */}
            {analysisResult && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={resultSummaryStyle}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#1e40af", marginBottom: 14 }}>Краткий вывод по анализу</div>
                  <div style={metricsGrid4}>
                    {[
                      { label: "Факт присутствия", value: analysisResult.attendance.status === "present" ? "Подтверждён" : "Не подтверждён" },
                      { label: "Уверенность распознавания", value: fmtV(analysisResult.attendance.confidence) },
                      { label: "Индекс вовлечённости", value: fmtV(analysisResult.engagement_metric.engagement_index) },
                      { label: "Оценка по видео", value: getEngagementLabel(analysisResult.engagement_metric.engagement_index) },
                    ].map((item) => (
                      <div key={item.label} style={summaryItemStyle}>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>{item.label}</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={subCardStyle}>
                  <div style={subSectionTitleStyle}>Показатели анализа видео</div>
                  <div style={metricsGrid4}>
                    <MetricCard label="Доля присутствия в кадре" value={analysisResult.engagement_metric.presence_ratio} hint="Как часто студент присутствовал в кадре" />
                    <MetricCard label="Уверенность распознавания" value={analysisResult.engagement_metric.face_match_confidence} hint="Точность сопоставления лица с шаблоном" />
                    <MetricCard label="Взгляд прямо (доля)" value={analysisResult.engagement_metric.head_pose_forward_ratio} hint="Устойчивость внимания по положению головы" />
                    <MetricCard label="Стабильность поведения" value={analysisResult.engagement_metric.frame_stability} hint="Устойчивость без резких смещений" />
                  </div>
                </div>

                <div style={subCardStyle}>
                  <button onClick={() => setShowTechnicalDetails((p) => !p)} style={outlineBtnStyle}>
                    {showTechnicalDetails ? "Скрыть технические детали" : "Показать технические детали"}
                  </button>
                  {showTechnicalDetails && (
                    <div style={{ marginTop: 14 }}>
                      <div style={metricsGrid4}>
                        <MetricCard label="Изменчивость положения головы" value={analysisResult.engagement_metric.head_pose_variance} hint="Ниже = устойчивее взгляд" />
                        <MetricCard label="Уровень активности движений" value={analysisResult.engagement_metric.motion_level} hint="Интенсивность движений в кадре" />
                        <MetricCard label="Обработано кадров" value={analysisResult.engagement_metric.frame_count} digits={0} hint="Количество кадров в анализе" />
                        <MetricCard label="Кадры с совпадением" value={analysisResult.meta.matched_faces} digits={0} hint="Кадры с совпавшим лицом" />
                      </div>
                      <div style={{ marginTop: 12, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 13, color: "#64748b" }}>
                        <span>Кадров обработано: <strong>{analysisResult.meta.processed_frames}</strong></span>
                        <span>Кадров с лицом: <strong>{analysisResult.meta.detected_faces}</strong></span>
                        <span>Кадров с позой: <strong>{analysisResult.meta.pose_detected_frames}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Interpretation table */}
          <div style={cardStyle}>
            <h2 style={sectionTitleStyle}>Интерпретация показателей</h2>
            <p style={{ ...sectionSubtitleStyle, marginBottom: 16 }}>Пояснение к показателям, которые использует система</p>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Показатель</th>
                    <th style={thStyle}>Что означает</th>
                    <th style={thStyle}>Как влияет на вывод</th>
                  </tr>
                </thead>
                <tbody>
                  {interpretationRows.map((row) => (
                    <tr key={row.name}>
                      <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{row.name}</td>
                      <td style={tdStyle}>{row.meaning}</td>
                      <td style={tdStyle}>{row.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <h2 style={sectionTitleStyle}>Рекомендации</h2>
                <p style={sectionSubtitleStyle}>Формируются на основе посещаемости, результатов и вовлечённости</p>
              </div>
              <button onClick={handleGenerateRecommendations} disabled={recLoading} style={btnPrimaryStyle}>
                {recLoading ? "Генерация..." : "Сгенерировать рекомендации"}
              </button>
            </div>
            {recError && <div style={inlineErrStyle}>{recError}</div>}
            {recommendations.length === 0 ? (
              <div style={emptyStyle}>Рекомендаций пока нет</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {recommendations.map((rec) => {
                  const tc = recTypeColor(rec.recommendation_type);
                  return (
                    <div key={rec.id} style={{ ...recCardStyle, ...(rec.is_read ? {} : recCardUnreadStyle) }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{rec.title}</span>
                            <span style={{ display: "inline-flex", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: tc.bg, color: tc.color }}>{translateRecType(rec.recommendation_type)}</span>
                            {rec.confidence_score != null && (
                              <span style={{ fontSize: 12, color: "#94a3b8" }}>уверенность: {fmtV(rec.confidence_score, 2)}</span>
                            )}
                          </div>
                          <p style={{ fontSize: 14, color: "#475569", lineHeight: 1.55 }}>{rec.text}</p>
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {rec.is_read ? (
                            <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#dcfce7", color: "#16a34a" }}>Прочитано</span>
                          ) : (
                            <button onClick={() => handleMarkAsRead(rec.id)} style={outlineBtnStyle}>Отметить прочитанным</button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---- Styles ----
const breadcrumbStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#64748b", flexWrap: "wrap" };
const bLink: CSSProperties = { color: "#2563eb", textDecoration: "none", fontWeight: 500 };
const bSep: CSSProperties = { color: "#cbd5e1" };
const loadingStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "40px 20px", color: "#64748b", fontSize: 15 };
const spinnerStyle: CSSProperties = { width: 20, height: 20, border: "2.5px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 };
const errStyle: CSSProperties = { padding: "16px 20px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 14 };
const heroCardStyle: CSSProperties = { background: "linear-gradient(135deg,#eff6ff 0%,#fff 55%,#eef2ff 100%)", border: "1px solid #dbeafe", borderRadius: 20, padding: "22px 26px", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", boxShadow: "0 4px 20px rgba(37,99,235,0.07)" };
const heroAvatarStyle: CSSProperties = { width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#2563eb,#7c3aed)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22, flexShrink: 0, boxShadow: "0 6px 16px rgba(37,99,235,0.3)" };
const groupTagStyle: CSSProperties = { display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#dbeafe", color: "#1d4ed8" };
const grid3Style: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };
const statCardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" };
const statLabelStyle: CSSProperties = { fontSize: 13, color: "#64748b", fontWeight: 500, marginBottom: 8 };
const statValueStyle: CSSProperties = { fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, marginBottom: 6 };
const statHintStyle: CSSProperties = { fontSize: 12, color: "#94a3b8" };
const cardStyle: CSSProperties = { background: "white", border: "1px solid #e2e8f0", borderRadius: 20, padding: "22px 24px", boxShadow: "0 4px 20px rgba(15,23,42,0.06)" };
const videoIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(124,58,237,0.28)" };
const sectionTitleStyle: CSSProperties = { fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 4 };
const sectionSubtitleStyle: CSSProperties = { fontSize: 13, color: "#64748b" };
const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 };
const selectStyle: CSSProperties = { width: "100%", maxWidth: 480, padding: "11px 14px", border: "1.5px solid #e2e8f0", borderRadius: 12, fontSize: 14, color: "#0f172a", background: "#f8fafc" };
const subSectionStyle: CSSProperties = { marginBottom: 4 };
const subSectionTitleStyle: CSSProperties = { fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 };
const videoPreviewStyle: CSSProperties = { width: "100%", maxWidth: 600, borderRadius: 14, background: "#0f172a", border: "1px solid #e2e8f0", display: "block" };
const btnPrimaryStyle: CSSProperties = { padding: "10px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 3px 10px rgba(37,99,235,0.28)" };
const btnGreenStyle: CSSProperties = { padding: "10px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 3px 10px rgba(5,150,105,0.28)" };
const btnDangerStyle: CSSProperties = { padding: "10px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#dc2626,#f87171)", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" };
const outlineBtnStyle: CSSProperties = { padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "white", color: "#334155", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const fileDropStyle: CSSProperties = { flex: 1, minWidth: 220, display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderRadius: 12, border: "1.5px dashed #cbd5e1", background: "#f8fafc", cursor: "pointer" };
const inlineErrStyle: CSSProperties = { marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 };
const inlineSuccessStyle: CSSProperties = { marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 13, fontWeight: 600 };
const progressBoxStyle: CSSProperties = { marginTop: 16, padding: "14px 18px", borderRadius: 12, border: "1px solid #bfdbfe", background: "#eff6ff" };
const recordingBoxStyle: CSSProperties = { marginTop: 12, padding: "10px 14px", borderRadius: 10, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 14, color: "#dc2626", display: "flex", alignItems: "center" };
const successBoxStyle: CSSProperties = { marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", fontSize: 14 };
const divStyle: CSSProperties = { margin: "20px 0", height: 1, background: "#f1f5f9" };
const resultSummaryStyle: CSSProperties = { border: "1px solid #bfdbfe", borderRadius: 14, padding: "16px 18px", background: "#eff6ff" };
const subCardStyle: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 18px", background: "#f8fafc" };
const metricsGrid4: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 };
const summaryItemStyle: CSSProperties = { background: "white", border: "1px solid #dbeafe", borderRadius: 10, padding: "12px 14px" };
const metricCardStyle: CSSProperties = { background: "white", border: "1px solid #dbeafe", borderRadius: 10, padding: "12px 14px" };
const tableWrapStyle: CSSProperties = { overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 14 };
const tableStyle: CSSProperties = { width: "100%", borderCollapse: "separate", borderSpacing: 0 };
const thStyle: CSSProperties = { textAlign: "left", padding: "11px 16px", background: "#f8fafc", color: "#475569", fontWeight: 600, fontSize: 12, letterSpacing: "0.5px", textTransform: "uppercase", borderBottom: "1px solid #e2e8f0" };
const tdStyle: CSSProperties = { padding: "13px 16px", borderBottom: "1px solid #f1f5f9", color: "#334155", fontSize: 14, verticalAlign: "top" };
const recCardStyle: CSSProperties = { border: "1px solid #e2e8f0", borderRadius: 14, padding: "14px 16px", background: "#f8fafc" };
const recCardUnreadStyle: CSSProperties = { borderColor: "#bfdbfe", background: "#eff6ff" };
const emptyStyle: CSSProperties = { padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 };
