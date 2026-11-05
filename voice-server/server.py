"""HTTP + WebRTC entry point for the voice bot.

Routes:
  POST/PATCH /api/offer      WebRTC signalling for the browser (Pipecat SmallWebRTC)
  GET  /calls/{id}           call status + recording link, for the web app (needs the shared secret)
  GET  /recordings/{file}    recording audio
  GET  /health
"""

import asyncio
import json
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv(override=True)

import uvicorn  # noqa: E402
from fastapi import Body, FastAPI, Header, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from loguru import logger  # noqa: E402

from pipecat.transports.smallwebrtc.connection import IceServer, SmallWebRTCConnection  # noqa: E402
from pipecat.transports.smallwebrtc.request_handler import (  # noqa: E402
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

import config  # noqa: E402
from bot import run_call  # noqa: E402
from models import load_models  # noqa: E402

LANGUAGES = {"en", "hi"}
calls_in_progress: set[asyncio.Task] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not config.VOICE_SERVER_SECRET:
        raise RuntimeError("VOICE_SERVER_SECRET is not set")
    await asyncio.to_thread(load_models)
    yield
    await webrtc.close()


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

def _ice_servers() -> list[IceServer]:
    servers = [IceServer(urls="stun:stun.l.google.com:19302")]
    if config.TURN_URL:
        servers.append(IceServer(urls=config.TURN_URL, username=config.TURN_USERNAME, credential=config.TURN_CREDENTIAL))
    return servers


webrtc = SmallWebRTCRequestHandler(ice_servers=_ice_servers())


@app.post("/api/offer")
async def offer(body: dict = Body(...)):
    # The browser SDK sends `requestData` (camelCase), which a typed body would silently drop.
    fields = {"sdp", "type", "pc_id", "restart_pc", "request_data", "requestData"}
    try:
        request = SmallWebRTCRequest.from_dict({k: v for k, v in body.items() if k in fields})
    except TypeError:
        raise HTTPException(400, "Invalid WebRTC offer")
    data = request.request_data if isinstance(request.request_data, dict) else {}
    call_id, language = str(data.get("callId", "")), data.get("language")
    try:
        call_id = str(uuid.UUID(call_id))
    except ValueError:
        raise HTTPException(400, "callId must be a UUID")
    if language not in LANGUAGES:
        raise HTTPException(400, "language must be 'en' or 'hi'")
    # A renegotiation of a live call reuses its pc_id; a brand-new offer must not reuse a call id.
    if not request.pc_id and (config.CALLS_DIR / f"{call_id}.json").exists():
        raise HTTPException(409, "This call id was already used")

    async def on_connection(connection: SmallWebRTCConnection):
        task = asyncio.create_task(run_call(connection, call_id, language))
        calls_in_progress.add(task)
        task.add_done_callback(calls_in_progress.discard)

    return await webrtc.handle_web_request(request=request, webrtc_connection_callback=on_connection)


@app.patch("/api/offer")
async def ice_candidate(request: SmallWebRTCPatchRequest):
    await webrtc.handle_patch_request(request)
    return {"status": "success"}


@app.get("/calls/{call_id}")
async def call_status(call_id: str, authorization: str = Header(default="")):
    if authorization != f"Bearer {config.VOICE_SERVER_SECRET}":
        raise HTTPException(401)
    try:
        call_id = str(uuid.UUID(call_id))
    except ValueError:
        raise HTTPException(404)
    path = config.CALLS_DIR / f"{call_id}.json"
    if not path.exists():
        raise HTTPException(404)
    status = json.loads(path.read_text())
    file = status.get("recording")
    return {
        "ended": status.get("ended", False),
        "recordingUrl": f"{config.PUBLIC_URL}/recordings/{file}" if file else None,
    }


@app.get("/recordings/{name}")
async def recording(name: str):
    # Only files this server wrote: "<uuid>.mp3" or "<uuid>.wav".
    stem, _, ext = name.rpartition(".")
    try:
        uuid.UUID(stem)
    except ValueError:
        raise HTTPException(404)
    path = config.RECORDINGS_DIR / f"{stem}.{ext}"
    if ext not in {"mp3", "wav"} or not path.exists():
        raise HTTPException(404)
    return FileResponse(path, media_type="audio/mpeg" if ext == "mp3" else "audio/wav")


@app.get("/health")
async def health():
    return {"ok": True, "calls": len(calls_in_progress)}


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=7860)
    args = parser.parse_args()
    logger.info(f"Voice server on {args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port)
