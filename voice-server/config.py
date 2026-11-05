"""Settings for the voice server, read from the environment (.env is loaded in server.py)."""

import os
from pathlib import Path


def _float(name: str, default: float) -> float:
    return float(os.getenv(name, default))


# Where the web app lives. The bot asks it for the sales prompt at the start of each call,
# so product.ts stays the single source of truth.
APP_URL = os.getenv("APP_URL", "http://localhost:3001").rstrip("/")

# Shared secret between the web app and this server (both directions).
VOICE_SERVER_SECRET = os.environ.get("VOICE_SERVER_SECRET", "")

# Comma-separated origins allowed to start calls from the browser.
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(",") if o.strip()]

# Optional TURN relay, needed when callers sit behind strict NATs/firewalls that block
# direct UDP to the GPU server. The browser gets the same values via NEXT_PUBLIC_TURN_*.
TURN_URL = os.getenv("TURN_URL", "")
TURN_USERNAME = os.getenv("TURN_USERNAME", "")
TURN_CREDENTIAL = os.getenv("TURN_CREDENTIAL", "")

# Public base URL of this server, used to build recording links.
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:7860").rstrip("/")

# STT: Whisper-Hindi2Hinglish Apex converted to CTranslate2 (see scripts/convert_whisper.sh).
WHISPER_MODEL_DIR = os.getenv("WHISPER_MODEL_DIR", "models/whisper-hindi2hinglish-apex-ct2")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cuda")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float16")

# LLM: Sarvam-30B served by vLLM's OpenAI-compatible API (see scripts/serve_llm.sh).
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://localhost:8000/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "EMPTY")
LLM_MODEL = os.getenv("LLM_MODEL", "sarvamai/sarvam-30b")

# TTS: Indic Parler-TTS.
TTS_MODEL = os.getenv("TTS_MODEL", "ai4bharat/indic-parler-tts")
TTS_DEVICE = os.getenv("TTS_DEVICE", "cuda:0")
# Seconds of audio per streamed chunk. Smaller = faster first sound, but must stay
# above what the GPU can generate in real time or playback will stutter.
TTS_CHUNK_SECONDS = _float("TTS_CHUNK_SECONDS", 0.5)
# Parler picks the voice from a text description. Named speakers come from the model card.
TTS_VOICE_EN = os.getenv(
    "TTS_VOICE_EN",
    "Mary speaks in a warm, friendly and confident tone at a moderate pace. "
    "The recording is of very high quality, with her voice sounding clear and very close up.",
)
TTS_VOICE_HI = os.getenv(
    "TTS_VOICE_HI",
    "Divya speaks in a warm, friendly and confident tone at a moderate pace. "
    "The recording is of very high quality, with her voice sounding clear and very close up.",
)

# Silero VAD: how long the caller must be silent before their turn ends (0.3–0.5 s).
VAD_STOP_SECS = min(max(_float("VAD_STOP_SECS", 0.4), 0.3), 0.5)

# Recordings and per-call status files.
DATA_DIR = Path(os.getenv("DATA_DIR", "data"))
RECORDINGS_DIR = DATA_DIR / "recordings"
CALLS_DIR = DATA_DIR / "calls"
