from pathlib import Path


# =========================
# PATHS
# =========================

BASE_DIR = Path(__file__).resolve().parent
SAMPLES_DIR = BASE_DIR / "samples"
OUTPUT_DIR = BASE_DIR / "output"
TEMPLATES_DIR = BASE_DIR / "templates"

OUTPUT_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)


# =========================
# DEFAULT FILES
# =========================

DEFAULT_VIDEO_PATH = SAMPLES_DIR / "sample.mp4"
DEFAULT_TEMPLATE_PATH = TEMPLATES_DIR / "student_3.jpg"


# =========================
# VIDEO PROCESSING
# =========================

# Было 5 / 200, это всё ещё тяжело для CPU.
FRAME_STRIDE = 12
MAX_FRAMES = 40

# Максимальная ширина кадра перед face detection
MAX_FRAME_WIDTH = 640

# Реже выполнять face detection
FACE_DETECTION_EVERY_N_FRAMES = 2


# =========================
# MODELS
# =========================

MODEL_NAME = "insightface+headpose+motion"
MODEL_VERSION = "v2-fast"

INSIGHTFACE_MODEL_NAME = "buffalo_l"
INSIGHTFACE_PROVIDERS = ["CPUExecutionProvider"]

# Меньший размер детекции = быстрее
INSIGHTFACE_DET_SIZE = (320, 320)


# =========================
# THRESHOLDS
# =========================

FACE_DET_THRESHOLD = 0.5
FACE_MATCH_THRESHOLD = 0.35


# =========================
# BACKEND SETTINGS
# =========================

BACKEND_BASE_URL = "http://127.0.0.1:8000"

DEFAULT_LESSON_ID = 1
DEFAULT_STUDENT_ID = 4

BACKEND_TOKEN = "CHANGE_ME"