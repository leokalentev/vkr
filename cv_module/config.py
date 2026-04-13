from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
SAMPLES_DIR = BASE_DIR / "samples"
OUTPUT_DIR = BASE_DIR / "output"
TEMPLATES_DIR = BASE_DIR / "templates"

OUTPUT_DIR.mkdir(exist_ok=True)
TEMPLATES_DIR.mkdir(exist_ok=True)

DEFAULT_VIDEO_PATH = SAMPLES_DIR / "sample.mp4"
DEFAULT_TEMPLATE_PATH = TEMPLATES_DIR / "student_1.jpg"

FRAME_STRIDE = 5
MAX_FRAMES = 200

MODEL_NAME = "insightface+mediapipe"
MODEL_VERSION = "v1"

INSIGHTFACE_MODEL_NAME = "buffalo_l"
INSIGHTFACE_PROVIDERS = ["CPUExecutionProvider"]

FACE_DET_THRESHOLD = 0.5

# Порог similarity для "это тот же человек"
# потом можно подбирать по факту
FACE_MATCH_THRESHOLD = 0.35