# Voice server

Runs the sales calls on our own GPU machine with [Pipecat](https://github.com/pipecat-ai/pipecat):

| Step | Model | Runs in |
|---|---|---|
| Turn-taking | Silero VAD (turn ends after `VAD_STOP_SECS`, 0.3–0.5 s) | this server |
| Speech-to-text | Oriserve/Whisper-Hindi2Hinglish-Apex, faster-whisper (CTranslate2) | this server |
| LLM | sarvamai/sarvam-30b, thinking off | vLLM (separate process) |
| Text-to-speech | ai4bharat/indic-parler-tts, streamed in ~0.5 s chunks | this server |

The browser connects over WebRTC (Pipecat SmallWebRTC). Replies are streamed sentence by sentence, and the caller can interrupt the bot at any time; an interruption also stops the GPU work for the sentence being spoken.

## Hardware

- Sarvam-30B in bf16 needs about 64 GB of GPU memory, plus room for the KV cache.
- Whisper Apex (fp16) and Parler-TTS need roughly another 6–8 GB together.
- One 80 GB GPU (A100/H100) can fit everything with `GPU_MEMORY_UTILIZATION=0.85` for vLLM. Two GPUs are more comfortable: run vLLM on both with `TENSOR_PARALLEL=2`, or put vLLM on one and set `WHISPER_DEVICE`/`TTS_DEVICE` to the other (`cuda:1`; set `CUDA_VISIBLE_DEVICES` accordingly).
- Ubuntu with recent NVIDIA drivers and CUDA 12.

## Setup

```bash
cd voice-server

# 1. The LLM (own virtualenv; uses Sarvam's official vLLM hot-patch, vllm==0.15.0)
export LLM_API_KEY=$(openssl rand -hex 32)
./scripts/serve_llm.sh            # serves on :8000; keep it running (tmux/systemd)

# 2. The voice server
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # needs git-lfs installed (Parler's audiotools dependency)
huggingface-cli login             # Indic Parler-TTS is gated: accept its terms on Hugging Face first
./scripts/convert_whisper.sh      # Whisper Apex → CTranslate2, into models/
cp .env.example .env              # fill in VOICE_SERVER_SECRET, LLM_API_KEY, APP_URL, PUBLIC_URL…
python server.py --port 7860
```

Put the server behind HTTPS (e.g. Caddy or nginx with a domain). Browsers only allow microphone access and calls to an HTTPS server from an HTTPS site. WebRTC media goes over UDP directly to this machine: open the UDP port range in the firewall, or set up a TURN server (`TURN_*` here and `NEXT_PUBLIC_TURN_*` in the web app) for callers on strict networks.

The web app's sync route also calls vLLM for the post-call summary, so `LLM_BASE_URL` must be reachable from where the web app runs (put vLLM behind HTTPS too; it is protected by `LLM_API_KEY`).

## Endpoints

| Route | Used by |
|---|---|
| `POST`/`PATCH /api/offer` | the browser, to start a call (WebRTC signalling). Body `requestData`: `{ callId: uuid, language: "en" \| "hi" }` |
| `GET /calls/{id}` | the web app (`Authorization: Bearer VOICE_SERVER_SECRET`): `{ ended, recordingUrl }` |
| `GET /recordings/{id}.mp3` | the call detail page's audio player |
| `GET /health` | monitoring |

## Files

- `server.py`: FastAPI app; loads Whisper and Parler once at startup and shares them across calls.
- `bot.py`: the Pipecat pipeline for one call, plus recording (16 kHz mono MP3) and the max call length.
- `models.py`: shared Whisper STT service and the streaming Indic Parler-TTS service.
- `processors.py`: removes `<think>` blocks if the model emits any; ends the call after the bot says goodbye.

## Tuning

- `VAD_STOP_SECS`: shorter makes the bot answer faster but cuts off slow speakers.
- `TTS_CHUNK_SECONDS`: shorter means faster first audio, but it must stay above what the GPU can generate in real time or the voice will stutter.
- `TTS_VOICE_EN` / `TTS_VOICE_HI`: Parler picks the voice from a text description. Recommended speakers from the model card: Mary or Thoma (Indian English), Divya or Rohit (Hindi).
