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
type AcademicSnapshot = {
  id: number; student_id: number; group_id: number;
  subject_name: string; total_classes: number; attended_classes: number;
  excused_missed_classes: number; average_score: number; imported_at: string;
};
type AssessmentResultRead = {
  id: number; lesson_id: number; student_id: number;
  score: number | null; max_score: number | null; grade_label: string | null;
  final_score: number | null; teacher_comment: string | null; created_at: string;
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
  {
    name: "Посещаемость",
    range: "0–100%",
    meaning: "Доля занятий, на которых студент был физически зафиксирован (лично или через видеоанализ).",
    effect: "Вес 30% в интегральном индексе. Менее 50% — автоматически флаг риска.",
  },
  {
    name: "Учебный результат",
    range: "0–50 баллов",
    meaning: "Средний балл из журнала успеваемости (импортируется из Excel). Отражает академическую успешность по предмету.",
    effect: "Вес 30% в интегральном индексе. Баллы за конкретные мероприятия суммируются с базовым баллом.",
  },
  {
    name: "Индекс вовлечённости",
    range: "0.00–1.00",
    meaning: "Поведенческий индекс, вычисленный по видео: присутствие в кадре (10%), распознавание лица (20%), взгляд прямо (20%), устойчивость положения (10%), двигательная активность (20%), стабильность позы (10%), оценка за работу (10%).",
    effect: "Вес 40% в интегральном индексе. Главный показатель активного участия студента во время занятия.",
  },
  {
    name: "Интегральный индекс",
    range: "0.00–1.00",
    meaning: "Итоговый показатель = 30% × посещаемость + 30% × учебный результат + 40% × вовлечённость. Если какой-то компонент отсутствует, веса перераспределяются между остальными.",
    effect: "Основа для уровня (Высокий / Хороший / Средний / Низкий) и для автоматических рекомендаций. ≥0.85 — Высокий, ≥0.70 — Хороший, ≥0.50 — Средний, <0.50 — Низкий.",
  },
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
function engagementLevelColor(level: string): { bg: string; color: string } {
  const m: Record<string, { bg: string; color: string }> = {
    high: { bg: "#dcfce7", color: "#16a34a" }, good: { bg: "#d1fae5", color: "#059669" },
    medium: { bg: "#fef9c3", color: "#ca8a04" }, low: { bg: "#fee2e2", color: "#dc2626" },
  };
  return m[level] ?? { bg: "#f1f5f9", color: "#64748b" };
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

  // Visualization overlay
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const faceDetIntervalRef = useRef<number | null>(null);
  const motionIntervalRef = useRef<number | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const detectedFacesRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);
  const motionLevelRef = useRef<number>(0);
  const scanYRef = useRef<number>(0);
  const isRecordingRef = useRef(false);

  const [data, setData] = useState<StudentAnalyticsSummary | null>(null);
  const [snapshots, setSnapshots] = useState<AcademicSnapshot[]>([]);
  const [assessmentResults, setAssessmentResults] = useState<AssessmentResultRead[]>([]);
  const [lessons, setLessons] = useState<LessonShortRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [lessonAlreadyAnalyzed, setLessonAlreadyAnalyzed] = useState(false);
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

  // Send report
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");

  // Exam grade form (0-50)
  const [showGradeForm, setShowGradeForm] = useState(false);
  const [gradeScore, setGradeScore] = useState("");
  const [gradeComment, setGradeComment] = useState("");
  const [gradeLoading, setGradeLoading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [gradeSuccess, setGradeSuccess] = useState("");

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

  useEffect(() => { isRecordingRef.current = recording; }, [recording]);
  useEffect(() => { return () => { stopVisualization(); stopCameraTracks(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const loadSnapshots = async () => {
    try {
      const res = await api.get<AcademicSnapshot[]>(`/students/${id}/academic-snapshots`);
      setSnapshots(res.data);
    } catch { setSnapshots([]); }
  };
  const loadAssessmentResults = async () => {
    try {
      const res = await api.get<AssessmentResultRead[]>(`/students/${id}/results`);
      setAssessmentResults(res.data);
    } catch { setAssessmentResults([]); }
  };
  const loadAll = async () => {
    try {
      setLoading(true); setError("");
      await Promise.all([loadStudentAnalytics(), loadLessons(), loadSnapshots(), loadAssessmentResults()]);
    } catch { setError("Не удалось загрузить аналитику студента"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [id]);// eslint-disable-line react-hooks/exhaustive-deps

  // Check if the selected lesson has already been analyzed for this student
  useEffect(() => {
    if (!selectedLessonId || !id) { setLessonAlreadyAnalyzed(false); return; }
    api.get<{ student_id: number }[]>(`/lessons/${selectedLessonId}/engagement-metrics`)
      .then((res) => {
        const analyzed = res.data.some((m) => m.student_id === Number(id));
        setLessonAlreadyAnalyzed(analyzed);
      })
      .catch(() => setLessonAlreadyAnalyzed(false));
  }, [selectedLessonId, id]);

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedVideo(e.target.files?.[0] ?? null); setRecordedBlob(null); setRecordedFileName(""); setAnalysisError(""); setAnalysisSuccess("");
  };
  const stopCameraTracks = () => {
    stopVisualization();
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraEnabled(false);
  };
  const handleEnableCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        // Start visualization after stream dimensions settle
        setTimeout(startVisualization, 400);
      }
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
    if (lessonAlreadyAnalyzed) { setAnalysisError("Мониторинг для этого мероприятия уже был проведён. Повторный анализ недоступен."); return; }
    try {
      setAnalysisLoading(true); setElapsedSeconds(0); setAnalysisError(""); setAnalysisSuccess(""); setAnalysisResult(null); setShowTechnicalDetails(false);
      const fd = new FormData(); fd.append("lesson_id", selectedLessonId); fd.append("student_id", id); fd.append("file", fileToSend);
      const res = await api.post<VideoAnalysisResponse>("/cv/analyze-video", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setAnalysisResult(res.data); setAnalysisSuccess("Видео успешно обработано, результаты сохранены");
      setLessonAlreadyAnalyzed(true);
      await loadStudentAnalytics();
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

  // ---- Camera visualization ----
  const stopVisualization = () => {
    if (animFrameRef.current)    { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (faceDetIntervalRef.current) { clearInterval(faceDetIntervalRef.current); faceDetIntervalRef.current = null; }
    if (motionIntervalRef.current)  { clearInterval(motionIntervalRef.current);  motionIntervalRef.current = null; }
    prevFrameDataRef.current = null;
    detectedFacesRef.current = [];
    motionLevelRef.current = 0;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startVisualization = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // ── Helpers ────────────────────────────────────────────────────
    const drawBrackets = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      const len = 28, pad = 14;
      ctx.strokeStyle = "rgba(0,255,128,0.75)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, pad + len); ctx.lineTo(pad, pad); ctx.lineTo(pad + len, pad);
      ctx.moveTo(W - pad - len, pad); ctx.lineTo(W - pad, pad); ctx.lineTo(W - pad, pad + len);
      ctx.moveTo(pad, H - pad - len); ctx.lineTo(pad, H - pad); ctx.lineTo(pad + len, H - pad);
      ctx.moveTo(W - pad - len, H - pad); ctx.lineTo(W - pad, H - pad); ctx.lineTo(W - pad, H - pad - len);
      ctx.stroke();
    };

    const drawFaceBox = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
      const len = Math.min(w, h) * 0.22;
      ctx.fillStyle = "rgba(0,255,128,0.04)";
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = "#00ff80";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
      ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
      ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
      ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
      ctx.stroke();
      const label = "● ЛИЦО ОБНАРУЖЕНО";
      ctx.font = "bold 11px monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = "rgba(0,18,8,0.75)";
      ctx.fillRect(x, y - 22, tw + 10, 20);
      ctx.fillStyle = "#00ff80";
      ctx.fillText(label, x + 5, y - 7);
    };

    const drawHUD = (ctx: CanvasRenderingContext2D, faceFound: boolean, motion: number, rec: boolean) => {
      const lines = [
        `FACE:   ${faceFound ? "DETECTED" : "SCANNING..."}`,
        `MOTION: ${(motion * 100).toFixed(0)}%`,
        rec ? "● REC" : "● LIVE",
      ];
      const lh = 16, padX = 8, padY = 6;
      const bW = 160, bH = lines.length * lh + padY * 2;
      ctx.fillStyle = "rgba(0,10,5,0.65)";
      ctx.fillRect(10, 10, bW, bH);
      ctx.font = "11px monospace";
      lines.forEach((line, i) => {
        if (i === 0)      ctx.fillStyle = faceFound ? "#00ff80" : "#ffcc00";
        else if (i === 2) ctx.fillStyle = rec ? "#ff4444" : "#00ff80";
        else              ctx.fillStyle = "#00ff80";
        ctx.fillText(line, 10 + padX, 10 + padY + lh * (i + 0.82));
      });
    };

    const drawMotionBar = (ctx: CanvasRenderingContext2D, W: number, H: number, motion: number) => {
      const bH = 5, pad = 14, bW = W - pad * 2;
      ctx.fillStyle = "rgba(0,10,5,0.45)";
      ctx.fillRect(pad, H - bH - 8, bW, bH);
      const color = motion < 0.3 ? "#00ff80" : motion < 0.6 ? "#ffcc00" : "#ff4444";
      ctx.fillStyle = color;
      ctx.fillRect(pad, H - bH - 8, bW * Math.min(motion, 1), bH);
      ctx.fillStyle = "rgba(200,255,200,0.45)";
      ctx.font = "9px monospace";
      ctx.fillText("MOTION", pad, H - bH - 11);
    };

    // ── Motion detection (every 120 ms) ───────────────────────────
    const offscreen = document.createElement("canvas");
    let offCtx: CanvasRenderingContext2D | null = null;

    motionIntervalRef.current = window.setInterval(() => {
      if (video.readyState < 2) return;
      if (!offCtx || offscreen.width !== video.videoWidth) {
        offscreen.width  = video.videoWidth  || 640;
        offscreen.height = video.videoHeight || 480;
        offCtx = offscreen.getContext("2d", { willReadFrequently: true });
      }
      if (!offCtx) return;
      offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
      const frame = offCtx.getImageData(0, 0, offscreen.width, offscreen.height);
      const prev  = prevFrameDataRef.current;
      if (prev && prev.length === frame.data.length) {
        let diff = 0;
        const step = 4;
        for (let i = 0; i < frame.data.length; i += 4 * step) {
          const d = (Math.abs(frame.data[i]   - prev[i])
                  +  Math.abs(frame.data[i+1] - prev[i+1])
                  +  Math.abs(frame.data[i+2] - prev[i+2])) / 3;
          if (d > 20) diff++;
        }
        motionLevelRef.current = Math.min(1, (diff / (frame.data.length / (4 * step))) * 6);
      }
      prevFrameDataRef.current = new Uint8ClampedArray(frame.data);
    }, 120);

    // ── Face detection (every 180 ms, browser FaceDetector API) ──
    let faceDetector: any = null;
    try {
      // @ts-expect-error — experimental browser API
      if ("FaceDetector" in window) faceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    } catch { /* not supported */ }

    if (faceDetector) {
      faceDetIntervalRef.current = window.setInterval(async () => {
        if (video.readyState < 2) return;
        try {
          const faces = await faceDetector.detect(video);
          detectedFacesRef.current = faces.map((f: any) => ({
            x: f.boundingBox.x, y: f.boundingBox.y,
            width: f.boundingBox.width, height: f.boundingBox.height,
          }));
        } catch { detectedFacesRef.current = []; }
      }, 180);
    }

    // ── Draw loop ─────────────────────────────────────────────────
    const draw = () => {
      if (!video || !canvas) return;
      const W = video.videoWidth || 640;
      const H = video.videoHeight || 480;
      if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { animFrameRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, W, H);
      drawBrackets(ctx, W, H);
      detectedFacesRef.current.forEach((f) => drawFaceBox(ctx, f.x, f.y, f.width, f.height));
      drawHUD(ctx, detectedFacesRef.current.length > 0, motionLevelRef.current, isRecordingRef.current);
      drawMotionBar(ctx, W, H, motionLevelRef.current);

      animFrameRef.current = requestAnimationFrame(draw);
    };
    animFrameRef.current = requestAnimationFrame(draw);
  };

  const handleSaveGrade = async () => {
    if (!selectedLessonId) { setGradeError("Выберите мероприятие"); return; }
    const scoreNum = parseFloat(gradeScore);
    if (isNaN(scoreNum) || scoreNum < 0) { setGradeError("Введите корректные баллы (от 0 до 50)"); return; }
    if (scoreNum > 50) { setGradeError("Максимальный балл за экзамен — 50"); return; }
    try {
      setGradeLoading(true); setGradeError(""); setGradeSuccess("");
      await api.post("/assessment-results/", {
        lesson_id: Number(selectedLessonId),
        student_id: Number(id),
        score: scoreNum,
        max_score: 50,
        teacher_comment: gradeComment.trim() || null,
      });
      setGradeSuccess(`Балл за экзамен сохранён: ${scoreNum} / 50`);
      setGradeScore(""); setGradeComment("");
      setShowGradeForm(false);
      await Promise.all([loadAssessmentResults(), loadStudentAnalytics()]);
    } catch (err: any) {
      setGradeError(err?.response?.data?.detail || "Не удалось сохранить оценку");
    } finally { setGradeLoading(false); }
  };

  const handleSendReport = async () => {
    try {
      setSendLoading(true); setSendError(""); setSendSuccess("");
      await api.post(`/students/${id}/send-report`);
      setSendSuccess("Статистика успешно отправлена на почту студента");
    } catch (err: any) {
      setSendError(err?.response?.data?.detail || "Не удалось отправить письмо");
    } finally { setSendLoading(false); }
  };

  const analysisDurationText = useMemo(() => {
    const m = Math.floor(elapsedSeconds / 60), s = elapsedSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [elapsedSeconds]);
  const recordingDurationText = useMemo(() => {
    const m = Math.floor(recordingSeconds / 60), s = recordingSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [recordingSeconds]);

  // Compute average snapshot score for display
  const avgSnapshotScore = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots.reduce((acc, s) => acc + s.average_score, 0) / snapshots.length;
  }, [snapshots]);

  // Assessment results for selected lesson
  const lessonAssessments = useMemo(() => {
    if (!selectedLessonId) return [];
    return assessmentResults.filter((r) => r.lesson_id === Number(selectedLessonId));
  }, [assessmentResults, selectedLessonId]);

  const selectedLesson = useMemo(() => lessons.find((l) => String(l.id) === selectedLessonId), [lessons, selectedLessonId]);

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
              <div style={{ fontSize: 13, color: "#64748b" }}>
                Интегральный: <strong style={{ color: "#0f172a" }}>{fmtV(data.integral_engagement_score)}</strong>
                <span style={{ marginLeft: 6, color: "#94a3b8" }}>(0.30 × посещ. + 0.30 × учёба + 0.40 × вовл.)</span>
              </div>
              <button
                onClick={handleSendReport}
                disabled={sendLoading}
                style={sendBtnStyle}
                title="Отправить статистику посещений, оценок и итоговых баллов на email студента"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                {sendLoading ? "Отправка..." : "Отправить статистику"}
              </button>
              {sendError && <div style={{ fontSize: 12, color: "#dc2626", maxWidth: 280, textAlign: "right" }}>{sendError}</div>}
              {sendSuccess && <div style={{ fontSize: 12, color: "#16a34a", maxWidth: 280, textAlign: "right" }}>{sendSuccess}</div>}
            </div>
          </div>

          {/* Stat cards */}
          <div style={grid3Style}>
            {/* Attendance */}
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Посещаемость</div>
              <div style={statValueStyle}>{fmtPct(data.attendance_rate_percent)}</div>
              <div style={statHintStyle}>
                {data.attended_records} из {data.total_attendance_records} занятий
              </div>
              <div style={{ ...statHintStyle, marginTop: 4, color: "#94a3b8" }}>
                Индекс (0–1): {fmtV(data.attendance_score, 4)}
              </div>
            </div>

            {/* Academic score */}
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Средний балл по журналу</div>
              {avgSnapshotScore !== null ? (
                <>
                  <div style={statValueStyle}>
                    {avgSnapshotScore.toFixed(1)}
                    <span style={{ fontSize: 16, fontWeight: 500, color: "#64748b" }}> / 50</span>
                  </div>
                  <div style={statHintStyle}>
                    {snapshots.length} {snapshots.length === 1 ? "предмет" : snapshots.length < 5 ? "предмета" : "предметов"} в журнале
                  </div>
                </>
              ) : (
                <>
                  <div style={{ ...statValueStyle, color: "#94a3b8" }}>—</div>
                  <div style={statHintStyle}>Журнал не импортирован</div>
                </>
              )}
              {assessmentResults.length > 0 && (
                <div style={{ ...statHintStyle, marginTop: 4, color: "#2563eb" }}>
                  + {assessmentResults.length} {assessmentResults.length === 1 ? "оценка" : "оценки"} за мероприятия
                </div>
              )}
            </div>

            {/* Engagement */}
            <div style={statCardStyle}>
              <div style={statLabelStyle}>Индекс вовлечённости</div>
              <div style={statValueStyle}>{fmtV(data.average_engagement_index)}</div>
              <div style={statHintStyle}>
                {data.total_engagement_metrics === 0
                  ? "Мониторинг ещё не проводился"
                  : `По ${data.total_engagement_metrics} ${data.total_engagement_metrics === 1 ? "видеозаписи" : "видеозаписям"}`}
              </div>
              {data.average_engagement_index !== null && (
                <div style={{ ...statHintStyle, marginTop: 4, color: "#64748b" }}>
                  Уровень: {getEngagementLabel(data.average_engagement_index)}
                </div>
              )}
            </div>
          </div>

          {/* Academic snapshots detail */}
          {snapshots.length > 0 && (
            <div style={cardStyle}>
              <h2 style={sectionTitleStyle}>Успеваемость по журналу</h2>
              <p style={{ ...sectionSubtitleStyle, marginBottom: 14 }}>Данные импортированы из Excel-файла</p>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Предмет</th>
                      <th style={thStyle}>Всего занятий</th>
                      <th style={thStyle}>Посещено</th>
                      <th style={thStyle}>Уваж. пропуски</th>
                      <th style={thStyle}>Средний балл</th>
                      <th style={thStyle}>% посещ.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s) => {
                      const pct = s.total_classes > 0 ? ((s.attended_classes / s.total_classes) * 100).toFixed(1) : "—";
                      return (
                        <tr key={s.id}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{s.subject_name}</td>
                          <td style={tdStyle}>{s.total_classes}</td>
                          <td style={tdStyle}>
                            <span style={badgeGreenStyle}>{s.attended_classes}</span>
                          </td>
                          <td style={tdStyle}>{s.excused_missed_classes}</td>
                          <td style={tdStyle}>
                            <span style={badgeBlueStyle}>{s.average_score.toFixed(1)} / 50</span>
                          </td>
                          <td style={{ ...tdStyle, color: "#64748b" }}>{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Exam grades section */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={gradeIconStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </div>
              <div>
                <h2 style={sectionTitleStyle}>Баллы за экзамен / зачёт</h2>
                <p style={sectionSubtitleStyle}>Итоговая оценка = баллы за семестр (журнал) + баллы за экзамен · максимум 50 + 50 = 100</p>
              </div>
            </div>

            {lessons.length === 0 ? (
              <div style={{ color: "#94a3b8", fontSize: 14 }}>Нет мероприятий для оценивания</div>
            ) : (
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Мероприятие</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Семестр (журнал)</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Экзамен / зачёт</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Итог</th>
                      <th style={thStyle}>Комментарий</th>
                      <th style={{ ...thStyle, width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((lesson) => {
                      const ar = assessmentResults.find((r) => r.lesson_id === lesson.id);
                      // Match snapshot by subject_name ≈ lesson.title (case-insensitive)
                      const matchingSnap = snapshots.find(
                        (s) => s.subject_name.toLowerCase() === lesson.title.toLowerCase()
                      );
                      const semesterScore = matchingSnap !== undefined ? matchingSnap.average_score : avgSnapshotScore;
                      const examScore = ar?.score ?? null;
                      const total = semesterScore !== null && examScore !== null ? semesterScore + examScore : null;
                      const isEditing = showGradeForm && selectedLessonId === String(lesson.id);
                      return (
                        <tr key={lesson.id} style={isEditing ? { background: "#f0f7ff" } : {}}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>
                            <div>{lesson.title}</div>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>{new Date(lesson.lesson_date).toLocaleDateString("ru-RU")}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {semesterScore !== null ? (
                              <div>
                                <span style={badgeGrayStyle}>{semesterScore.toFixed(1)} / 50</span>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>из журнала, не редакт.</div>
                              </div>
                            ) : <span style={{ color: "#94a3b8" }}>не загружен</span>}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                                <input
                                  type="number" min={0} max={50} step={0.5}
                                  value={gradeScore}
                                  onChange={(e) => setGradeScore(e.target.value)}
                                  placeholder="0–50"
                                  style={{ ...inputSmStyle, width: 80, textAlign: "center" }}
                                  autoFocus
                                />
                                <span style={{ color: "#64748b", fontWeight: 600 }}>/ 50</span>
                              </div>
                            ) : examScore !== null ? (
                              <span style={badgeBlueStyle}>{examScore} / 50</span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 13 }}>не выставлен</span>
                            )}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center" }}>
                            {total !== null ? (
                              <span style={{ fontWeight: 800, fontSize: 18, color: total >= 60 ? "#16a34a" : total >= 40 ? "#ca8a04" : "#dc2626" }}>
                                {total.toFixed(1)}
                                <span style={{ fontWeight: 400, fontSize: 13, color: "#94a3b8" }}> / 100</span>
                              </span>
                            ) : <span style={{ color: "#94a3b8" }}>—</span>}
                          </td>
                          <td style={{ ...tdStyle, color: "#64748b" }}>
                            {isEditing ? (
                              <input
                                type="text"
                                placeholder="Комментарий..."
                                value={gradeComment}
                                onChange={(e) => setGradeComment(e.target.value)}
                                style={{ ...inputSmStyle, width: "100%" }}
                              />
                            ) : (
                              <span style={{ fontStyle: ar?.teacher_comment ? "normal" : "italic" }}>
                                {ar?.teacher_comment || "—"}
                              </span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            {isEditing ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <button onClick={handleSaveGrade} disabled={gradeLoading} style={saveBtnSmStyle}>
                                  {gradeLoading ? "..." : "Сохранить"}
                                </button>
                                <button onClick={() => { setShowGradeForm(false); setGradeScore(""); setGradeComment(""); setGradeError(""); }} style={cancelBtnSmStyle}>Отмена</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedLessonId(String(lesson.id));
                                  setGradeScore(ar?.score != null ? String(ar.score) : "");
                                  setGradeComment(ar?.teacher_comment ?? "");
                                  setGradeError(""); setGradeSuccess("");
                                  setShowGradeForm(true);
                                }}
                                style={editGradeBtnStyle}
                              >
                                {ar ? "Изменить" : "Выставить"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {gradeError && <div style={{ ...inlineErrStyle, marginTop: 12 }}>{gradeError}</div>}
            {gradeSuccess && <div style={{ ...inlineSuccessStyle, marginTop: 12 }}>{gradeSuccess}</div>}
          </div>

          {/* Video monitoring */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={videoIconStyle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div>
                <h2 style={sectionTitleStyle}>Видеомониторинг</h2>
                <p style={sectionSubtitleStyle}>Анализ вовлечённости через камеру или загрузку видео · <strong>один раз на мероприятие</strong></p>
              </div>
            </div>

            {/* Lesson selector */}
            <div style={{ marginBottom: 18 }}>
              <label style={labelStyle}>Мероприятие</label>
              <select value={selectedLessonId} onChange={(e) => { setSelectedLessonId(e.target.value); setAnalysisError(""); setAnalysisSuccess(""); setAnalysisResult(null); }} style={selectStyle}>
                <option value="">— Выберите мероприятие —</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>#{l.id} — {l.title} ({l.lesson_date})</option>
                ))}
              </select>
              {lessons.length === 0 && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "8px 12px" }}>
                  Занятия не найдены. Создайте их на{" "}
                  {data?.groups[0] ? (
                    <Link to={`/groups/${data.groups[0].id}`} style={{ color: "#2563eb", fontWeight: 600 }}>
                      странице группы {data.groups[0].name}
                    </Link>
                  ) : (
                    <Link to="/groups" style={{ color: "#2563eb", fontWeight: 600 }}>странице группы</Link>
                  )}.
                </div>
              )}
              {lessonAlreadyAnalyzed && selectedLessonId && (
                <div style={{ marginTop: 8, fontSize: 13, color: "#065f46", background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Мониторинг для этого мероприятия уже проведён. Повторный анализ заблокирован.
                </div>
              )}
            </div>

            {/* Camera section */}
            <div style={subSectionStyle}>
              <div style={subSectionTitleStyle}>Запись с камеры</div>
              {/* Video + canvas overlay wrapper */}
              <div style={{ position: "relative", display: "block", width: "100%", maxWidth: 600 }}>
                <video ref={videoRef} autoPlay muted playsInline style={videoPreviewStyle} />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute", top: 0, left: 0,
                    width: "100%", height: "100%",
                    pointerEvents: "none", borderRadius: 14,
                    display: cameraEnabled ? "block" : "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                {!cameraEnabled ? (
                  <button onClick={handleEnableCamera} disabled={lessonAlreadyAnalyzed} style={{ ...btnPrimaryStyle, opacity: lessonAlreadyAnalyzed ? 0.5 : 1 }}>Включить камеру</button>
                ) : (
                  <button onClick={handleDisableCamera} style={btnDangerStyle}>Выключить камеру</button>
                )}
                {cameraEnabled && !recording && !lessonAlreadyAnalyzed && (
                  <button onClick={handleStartRecording} style={btnGreenStyle}>Начать запись</button>
                )}
                {cameraEnabled && recording && (
                  <button onClick={handleStopRecording} style={btnDangerStyle}>Остановить запись</button>
                )}
                {recordedBlob && !recording && !lessonAlreadyAnalyzed && (
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
                <div style={{ ...fileDropStyle, opacity: lessonAlreadyAnalyzed ? 0.5 : 1, cursor: lessonAlreadyAnalyzed ? "not-allowed" : "pointer" }}
                  onClick={() => !lessonAlreadyAnalyzed && fileInputRef.current?.click()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span style={{ fontSize: 14, color: selectedVideo ? "#2563eb" : "#64748b", fontWeight: selectedVideo ? 600 : 400 }}>
                    {selectedVideo ? selectedVideo.name : "Выберите видеофайл"}
                  </span>
                  <input ref={fileInputRef} type="file" accept="video/*" onChange={handleVideoChange} style={{ display: "none" }} disabled={lessonAlreadyAnalyzed} />
                </div>
                <button onClick={handleAnalyzeUploadedVideo} disabled={analysisLoading || !selectedVideo || lessonAlreadyAnalyzed} style={{ ...btnGreenStyle, opacity: lessonAlreadyAnalyzed ? 0.5 : 1 }}>
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
                      { label: "Уровень по видео", value: getEngagementLabel(analysisResult.engagement_metric.engagement_index) },
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
            <p style={{ ...sectionSubtitleStyle, marginBottom: 16 }}>Что означает каждый показатель и как он влияет на итоговый вывод</p>
            <div style={tableWrapStyle}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Показатель</th>
                    <th style={{ ...thStyle, width: 80 }}>Диапазон</th>
                    <th style={thStyle}>Что означает</th>
                    <th style={thStyle}>Роль в системе</th>
                  </tr>
                </thead>
                <tbody>
                  {interpretationRows.map((row) => (
                    <tr key={row.name}>
                      <td style={{ ...tdStyle, fontWeight: 700, whiteSpace: "nowrap" }}>{row.name}</td>
                      <td style={{ ...tdStyle, color: "#2563eb", fontWeight: 600, whiteSpace: "nowrap" }}>{row.range}</td>
                      <td style={tdStyle}>{row.meaning}</td>
                      <td style={tdStyle}>{row.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
const fieldLabelStyle: CSSProperties = { display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 };
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
const emptyStyle: CSSProperties = { padding: "24px 0", textAlign: "center", color: "#94a3b8", fontSize: 14 };
const badgeGreenStyle: CSSProperties = { display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#dcfce7", color: "#16a34a" };
const badgeBlueStyle: CSSProperties = { display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#dbeafe", color: "#1d4ed8" };
const badgeGrayStyle: CSSProperties = { display: "inline-flex", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "#f1f5f9", color: "#475569" };
const inputSmStyle: CSSProperties = { padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#0f172a", background: "#f8fafc", boxSizing: "border-box" };
const gradeIconStyle: CSSProperties = { width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(245,158,11,0.28)" };
const editGradeBtnStyle: CSSProperties = { padding: "5px 12px", borderRadius: 8, border: "1.5px solid #dbeafe", background: "#eff6ff", color: "#2563eb", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const saveBtnSmStyle: CSSProperties = { padding: "5px 12px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#059669,#10b981)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const cancelBtnSmStyle: CSSProperties = { padding: "5px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: 12, fontWeight: 600, cursor: "pointer" };
const sendBtnStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#0891b2,#06b6d4)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 3px 10px rgba(8,145,178,0.3)" };
