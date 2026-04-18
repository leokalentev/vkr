import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";
import type { CSSProperties, ChangeEvent } from "react";

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

type LessonShortRead = {
  id: number;
  group_id: number;
  teacher_id: number;
  title: string;
  lesson_date: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  description: string | null;
};

type VideoAnalysisResponse = {
  attendance: {
    id: number;
    lesson_id: number;
    student_id: number;
    status: string;
    detected_by_cv: boolean;
    confidence: number | null;
    created_at: string;
  };
  engagement_metric: {
    id: number;
    lesson_id: number;
    student_id: number;
    presence_ratio: number;
    face_match_confidence: number | null;
    head_pose_forward_ratio: number;
    head_pose_variance: number;
    motion_level: number;
    frame_stability: number;
    grade_score: number | null;
    engagement_index: number;
    frame_count: number | null;
    model_name: string | null;
    model_version: string | null;
    weights_json?: Record<string, unknown> | null;
    computed_at: string;
  };
  meta: {
    processed_frames: number;
    detected_faces: number;
    matched_faces: number;
    pose_detected_frames: number;
    video_path: string;
    template_path: string;
  };
};

const interpretationRows = [
  {
    name: "Посещаемость",
    meaning: "Показывает, был ли студент реально зафиксирован на контрольном мероприятии.",
    effect: "Влияет на общий уровень участия студента в образовательном процессе.",
  },
  {
    name: "Учебный результат",
    meaning: "Отражает качество выполнения задания или контрольной работы.",
    effect: "Позволяет оценить академическую успешность студента.",
  },
  {
    name: "Индекс вовлечённости",
    meaning: "Объединяет поведенческие признаки: присутствие, внимание, устойчивость и активность.",
    effect: "Показывает, насколько студент был включён в процесс во время мероприятия.",
  },
  {
    name: "Интегральный индекс",
    meaning: "Итоговый показатель, объединяющий посещаемость, учебный результат и вовлечённость.",
    effect: "Используется системой для общего вывода и рекомендаций преподавателю.",
  },
];

export default function StudentPage() {
  const { id } = useParams();

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

  // online camera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedFileName, setRecordedFileName] = useState("");

  useEffect(() => {
    if (!analysisLoading) return;

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [analysisLoading]);

  useEffect(() => {
    if (!recording) return;

    const intervalId = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [recording]);

  useEffect(() => {
    return () => {
      stopCameraTracks();
    };
  }, []);

  const loadRecommendations = async () => {
    try {
      const res = await api.get(`/students/${id}/recommendations`);
      setRecommendations(res.data);
      setRecError("");
    } catch {
      setRecError("Не удалось загрузить рекомендации");
    }
  };

  const loadLessons = async () => {
    try {
      const res = await api.get<LessonShortRead[]>(`/students/${id}/lessons`);
      setLessons(res.data);

      if (res.data.length > 0 && !selectedLessonId) {
        setSelectedLessonId(String(res.data[0].id));
      }
    } catch {
      setLessons([]);
    }
  };

  const loadStudentAnalytics = async () => {
    const res = await api.get<StudentAnalyticsSummary>(`/students/${id}/analytics-summary`);
    setData(res.data);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadStudentAnalytics(),
        loadRecommendations(),
        loadLessons(),
      ]);
    } catch {
      setError("Не удалось загрузить аналитику студента");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleGenerateRecommendations = async () => {
    try {
      setRecLoading(true);
      setRecError("");
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

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedVideo(file);
    setRecordedBlob(null);
    setRecordedFileName("");
    setAnalysisError("");
    setAnalysisSuccess("");
  };

  const stopCameraTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraEnabled(false);
  };

  const handleEnableCamera = async () => {
    try {
      setCameraError("");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraEnabled(true);
    } catch (err) {
      console.error(err);
      setCameraError("Не удалось получить доступ к камере или микрофону");
      setCameraEnabled(false);
    }
  };

  const handleDisableCamera = () => {
    if (recording) {
      handleStopRecording();
    }
    stopCameraTracks();
  };

  const getSupportedMimeType = () => {
    const candidates = [
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=vp8",
      "video/webm",
    ];

    for (const candidate of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return "";
  };

  const handleStartRecording = () => {
    if (!streamRef.current) {
      setCameraError("Сначала включи камеру");
      return;
    }

    try {
      recordedChunksRef.current = [];
      setRecordedBlob(null);
      setRecordedFileName("");
      setRecordingSeconds(0);
      setAnalysisError("");
      setAnalysisSuccess("");

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, { mimeType })
        : new MediaRecorder(streamRef.current);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || "video/webm";
        const blob = new Blob(recordedChunksRef.current, { type: finalMimeType });
        setRecordedBlob(blob);

        const extension = finalMimeType.includes("webm") ? "webm" : "mp4";
        setRecordedFileName(`live_recording_student_${id}.${extension}`);
      };

      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error(err);
      setCameraError("Не удалось начать запись видео");
      setRecording(false);
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    setRecording(false);
  };

  const runAnalysis = async (fileToSend: File) => {
    if (!id) return;

    if (!selectedLessonId) {
      setAnalysisError("Выбери мероприятие");
      setAnalysisSuccess("");
      return;
    }

    try {
      setAnalysisLoading(true);
      setElapsedSeconds(0);
      setAnalysisError("");
      setAnalysisSuccess("");
      setAnalysisResult(null);
      setShowTechnicalDetails(false);

      const formData = new FormData();
      formData.append("lesson_id", selectedLessonId);
      formData.append("student_id", id);
      formData.append("file", fileToSend);

      const res = await api.post<VideoAnalysisResponse>("/cv/analyze-video", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setAnalysisResult(res.data);
      setAnalysisSuccess("Видео успешно обработано, результаты сохранены");

      await Promise.all([
        loadStudentAnalytics(),
        loadRecommendations(),
      ]);
    } catch (err: any) {
      setAnalysisError(
        err?.response?.data?.detail || "Не удалось выполнить анализ видео"
      );
      setAnalysisSuccess("");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleAnalyzeUploadedVideo = async () => {
    if (!selectedVideo) {
      setAnalysisError("Сначала выбери видеофайл");
      setAnalysisSuccess("");
      return;
    }

    await runAnalysis(selectedVideo);
  };

  const handleAnalyzeRecordedVideo = async () => {
    if (!recordedBlob || !recordedFileName) {
      setAnalysisError("Сначала запиши и останови видео");
      setAnalysisSuccess("");
      return;
    }

    const recordedFile = new File([recordedBlob], recordedFileName, {
      type: recordedBlob.type || "video/webm",
    });

    await runAnalysis(recordedFile);
  };

  const analysisDurationText = useMemo(() => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [elapsedSeconds]);

  const recordingDurationText = useMemo(() => {
    const minutes = Math.floor(recordingSeconds / 60);
    const seconds = recordingSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [recordingSeconds]);

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

  const lastAnalysisLevel =
    analysisResult?.engagement_metric.engagement_index != null
      ? getEngagementLabel(analysisResult.engagement_metric.engagement_index)
      : null;

  return (
    <div style={{ maxWidth: 980, margin: "40px auto" }}>
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
        <p><strong>Общий уровень вовлечённости:</strong> {translateEngagementLevel(data.engagement_level)}</p>
        <p>
          <strong>Интегральный индекс:</strong>{" "}
          {formatValue(data.integral_engagement_score)}
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Онлайн-видеомониторинг</h2>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Мероприятие</label>
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              style={inputStyle}
            >
              <option value="">Выбери мероприятие</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  #{lesson.id} — {lesson.title} ({lesson.lesson_date})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={videoPreviewStyle}
          />
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!cameraEnabled ? (
            <button onClick={handleEnableCamera}>Включить камеру</button>
          ) : (
            <button onClick={handleDisableCamera}>Выключить камеру</button>
          )}

          {cameraEnabled && !recording && (
            <button onClick={handleStartRecording}>Начать запись</button>
          )}

          {cameraEnabled && recording && (
            <button onClick={handleStopRecording}>Остановить запись</button>
          )}

          {recordedBlob && !recording && (
            <button onClick={handleAnalyzeRecordedVideo} disabled={analysisLoading}>
              {analysisLoading ? "Идёт анализ..." : "Остановить и проанализировать"}
            </button>
          )}
        </div>

        {cameraError && (
          <div style={{ color: "red", marginTop: 12 }}>{cameraError}</div>
        )}

        {recording && (
          <div style={recordingBoxStyle}>
            Идёт запись видео. Прошло времени: <strong>{recordingDurationText}</strong>
          </div>
        )}

        {recordedBlob && !recording && (
          <div style={{ marginTop: 12, color: "#166534" }}>
            Запись завершена. Видео готово к анализу.
          </div>
        )}

        <div style={dividerStyle} />

        <h3 style={{ marginTop: 0 }}>Или загрузить готовое видео</h3>

        <div style={formGridStyle}>
          <div>
            <label style={labelStyle}>Видео</label>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoChange}
              style={inputStyle}
            />
          </div>
        </div>

        {selectedVideo && (
          <div style={{ marginTop: 12 }}>
            Выбран файл: <strong>{selectedVideo.name}</strong>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <button onClick={handleAnalyzeUploadedVideo} disabled={analysisLoading}>
            {analysisLoading ? "Идёт анализ..." : "Запустить анализ загруженного видео"}
          </button>
        </div>

        {analysisLoading && (
          <div style={progressBoxStyle}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Выполняется анализ видео
            </div>
            <div style={{ marginBottom: 6 }}>
              Прошло времени: <strong>{analysisDurationText}</strong>
            </div>
            <div style={{ color: "#64748b" }}>
              Обычно обработка занимает 3–5 минут. Пожалуйста, не закрывайте страницу до завершения анализа.
            </div>
          </div>
        )}

        {analysisError && (
          <div style={{ color: "red", marginTop: 12 }}>{analysisError}</div>
        )}

        {analysisSuccess && (
          <div style={{ color: "green", marginTop: 12 }}>{analysisSuccess}</div>
        )}

        {analysisResult && (
          <div style={{ marginTop: 20, display: "grid", gap: 16 }}>
            <div style={resultSummaryCardStyle}>
              <h3 style={{ marginTop: 0, marginBottom: 14 }}>Краткий вывод по анализу</h3>

              <div style={summaryGridStyle}>
                <div style={summaryItemStyle}>
                  <div style={summaryLabelStyle}>Факт присутствия</div>
                  <div style={summaryValueStyle}>
                    {analysisResult.attendance.status === "present" ? "Подтверждён" : "Не подтверждён"}
                  </div>
                </div>

                <div style={summaryItemStyle}>
                  <div style={summaryLabelStyle}>Уверенность распознавания личности</div>
                  <div style={summaryValueStyle}>
                    {formatValue(analysisResult.attendance.confidence)}
                  </div>
                </div>

                <div style={summaryItemStyle}>
                  <div style={summaryLabelStyle}>Индекс вовлечённости</div>
                  <div style={summaryValueStyle}>
                    {formatValue(analysisResult.engagement_metric.engagement_index)}
                  </div>
                </div>

                <div style={summaryItemStyle}>
                  <div style={summaryLabelStyle}>Оценка вовлечённости по видео</div>
                  <div style={summaryValueStyle}>
                    {lastAnalysisLevel}
                  </div>
                </div>
              </div>
            </div>

            <div style={subCardStyle}>
              <h3 style={{ marginTop: 0 }}>Показатели анализа видео</h3>
              <div style={metricsGridStyle}>
                <MetricItem
                  label="Доля присутствия в кадре"
                  value={analysisResult.engagement_metric.presence_ratio}
                  hint="Показывает, как часто студент реально присутствовал в кадре во время анализа."
                />
                <MetricItem
                  label="Уверенность распознавания личности"
                  value={analysisResult.engagement_metric.face_match_confidence}
                  hint="Показывает, насколько уверенно система сопоставила лицо в видео с эталонным шаблоном."
                />
                <MetricItem
                  label="Доля времени, когда студент смотрел прямо"
                  value={analysisResult.engagement_metric.head_pose_forward_ratio}
                  hint="Позволяет приблизительно оценить устойчивость внимания во время мероприятия."
                />
                <MetricItem
                  label="Стабильность поведения в кадре"
                  value={analysisResult.engagement_metric.frame_stability}
                  hint="Показывает, насколько поведение студента было устойчивым без резких смещений."
                />
              </div>
            </div>

            <div style={subCardStyle}>
              <button
                onClick={() => setShowTechnicalDetails((prev) => !prev)}
                style={secondaryButtonStyle}
              >
                {showTechnicalDetails ? "Скрыть технические детали" : "Показать технические детали"}
              </button>

              {showTechnicalDetails && (
                <div style={{ marginTop: 16 }}>
                  <div style={metricsGridStyle}>
                    <MetricItem
                      label="Изменчивость положения головы"
                      value={analysisResult.engagement_metric.head_pose_variance}
                      hint="Чем ниже значение, тем более устойчиво сохранялось направление взгляда."
                    />
                    <MetricItem
                      label="Уровень двигательной активности"
                      value={analysisResult.engagement_metric.motion_level}
                      hint="Показывает, насколько интенсивными были движения в процессе анализа."
                    />
                    <MetricItem
                      label="Количество обработанных кадров"
                      value={
                        analysisResult.engagement_metric.frame_count != null
                          ? Number(analysisResult.engagement_metric.frame_count)
                          : null
                      }
                      digits={0}
                      hint="Сколько кадров видео было использовано при анализе."
                    />
                    <MetricItem
                      label="Кадры с подтверждённым совпадением"
                      value={analysisResult.meta.matched_faces}
                      digits={0}
                      hint="Сколько кадров содержали лицо, совпавшее с эталонным шаблоном."
                    />
                  </div>

                  <div style={{ marginTop: 16, color: "#64748b", fontSize: 14 }}>
                    <div>Обработано кадров: {analysisResult.meta.processed_frames}</div>
                    <div>Кадров с лицом: {analysisResult.meta.detected_faces}</div>
                    <div>Кадров с анализом положения головы: {analysisResult.meta.pose_detected_frames}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={gridStyle}>
        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Посещаемость</h2>
          <p><strong>Всего записей:</strong> {data.total_attendance_records}</p>
          <p><strong>Подтверждённых посещений:</strong> {data.attended_records}</p>
          <p>
            <strong>Процент посещаемости:</strong>{" "}
            {formatPercent(data.attendance_rate_percent)}
          </p>
          <p>
            <strong>Индекс посещаемости:</strong>{" "}
            {formatValue(data.attendance_score)}
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Учебные результаты</h2>
          <p><strong>Всего оценок:</strong> {data.total_assessment_results}</p>
          <p>
            <strong>Средний академический результат:</strong>{" "}
            {formatValue(data.average_academic_score)}
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={sectionTitleStyle}>Вовлечённость</h2>
          <p><strong>Всего рассчитанных метрик:</strong> {data.total_engagement_metrics}</p>
          <p>
            <strong>Средний индекс вовлечённости:</strong>{" "}
            {formatValue(data.average_engagement_index)}
          </p>
        </div>
      </div>

      <div style={cardStyle}>
        <h2 style={sectionTitleStyle}>Как интерпретируются показатели</h2>
        <p style={{ color: "#64748b", marginTop: 0 }}>
          Ниже приведено краткое пояснение, что именно учитывает система при формировании общего вывода.
        </p>

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
                <td style={tdStyle}><strong>{row.name}</strong></td>
                <td style={tdStyle}>{row.meaning}</td>
                <td style={tdStyle}>{row.effect}</td>
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

        <p style={{ color: "#64748b", marginTop: 0 }}>
          Рекомендации формируются на основе посещаемости, учебных результатов и уровня вовлечённости студента.
        </p>

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
                      Категория: {translateRecommendationType(rec.recommendation_type)} | уровень уверенности:{" "}
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

function MetricItem({
  label,
  value,
  digits = 4,
  hint,
}: {
  label: string;
  value: number | null;
  digits?: number;
  hint?: string;
}) {
  return (
    <div style={metricCardStyle}>
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: hint ? 8 : 0 }}>
        {formatValue(value, digits)}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function translateEngagementLevel(level: string) {
  const map: Record<string, string> = {
    high: "Высокий",
    good: "Хороший",
    medium: "Средний",
    low: "Низкий",
    insufficient_data: "Недостаточно данных",
  };
  return map[level] || level;
}

function translateRecommendationType(type: string) {
  const map: Record<string, string> = {
    academic: "Учебная поддержка",
    activity: "Активность",
    risk: "Риск",
    motivation: "Мотивация",
  };
  return map[type] || type;
}

function getEngagementLabel(value: number) {
  if (value >= 0.85) return "Высокая";
  if (value >= 0.7) return "Хорошая";
  if (value >= 0.5) return "Средняя";
  return "Низкая";
}

function formatValue(value: number | null, digits = 4) {
  if (value === null || value === undefined) return "Нет данных";
  return value.toFixed(digits);
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

const subCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 16,
  background: "#f8fafc",
};

const resultSummaryCardStyle: CSSProperties = {
  border: "1px solid #dbeafe",
  borderRadius: 12,
  padding: 18,
  background: "#f8fbff",
};

const progressBoxStyle: CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 10,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
};

const recordingBoxStyle: CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fef2f2",
};

const dividerStyle: CSSProperties = {
  margin: "24px 0",
  height: 1,
  background: "#e2e8f0",
};

const videoPreviewStyle: CSSProperties = {
  width: "100%",
  maxWidth: 640,
  borderRadius: 12,
  background: "#0f172a",
  border: "1px solid #cbd5e1",
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

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: 12,
};

const summaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
};

const summaryItemStyle: CSSProperties = {
  background: "white",
  border: "1px solid #dbeafe",
  borderRadius: 10,
  padding: 14,
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  marginBottom: 8,
};

const summaryValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#0f172a",
};

const metricCardStyle: CSSProperties = {
  background: "white",
  border: "1px solid #dbeafe",
  borderRadius: 10,
  padding: 14,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
};

const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: 8,
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  background: "white",
  boxSizing: "border-box",
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
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "left",
  background: "#f3f4f6",
};

const tdStyle: CSSProperties = {
  border: "1px solid #ddd",
  padding: "10px",
  verticalAlign: "top",
};