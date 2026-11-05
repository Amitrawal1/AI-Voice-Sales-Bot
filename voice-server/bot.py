"""One sales call: browser audio → Whisper Apex → Sarvam-30B → Indic Parler-TTS → browser audio."""

import asyncio
import json
from dataclasses import dataclass

import aiohttp
import numpy as np
import soundfile as sf
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import TTSSpeakFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker, ProcessorUnusablePolicy
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.audio.audio_buffer_processor import AudioBufferProcessor
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.turns.user_stop.speech_timeout_user_turn_stop_strategy import SpeechTimeoutUserTurnStopStrategy
from pipecat.turns.user_turn_strategies import UserTurnStrategies
from pipecat.workers.runner import WorkerRunner

import config
from models import IndicParlerTTSService, create_stt
from processors import GoodbyeDetector, ThinkingFilter

RECORDING_SAMPLE_RATE = 16000


@dataclass
class AgentConfig:
    system_prompt: str
    first_message: str
    end_call_phrases: list[str]
    max_duration_seconds: int


async def fetch_agent_config(language: str) -> AgentConfig:
    """The prompt is built by the web app from src/lib/product.ts."""
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
        async with session.get(
            f"{config.APP_URL}/api/agent-config",
            params={"language": language},
            headers={"Authorization": f"Bearer {config.VOICE_SERVER_SECRET}"},
        ) as res:
            res.raise_for_status()
            data = await res.json()
    return AgentConfig(
        system_prompt=data["systemPrompt"],
        first_message=data["firstMessage"],
        end_call_phrases=data["endCallPhrases"],
        max_duration_seconds=data["maxDurationSeconds"],
    )


def write_call_status(call_id: str, **status):
    config.CALLS_DIR.mkdir(parents=True, exist_ok=True)
    (config.CALLS_DIR / f"{call_id}.json").write_text(json.dumps(status))


def save_recording(call_id: str, pcm: bytes) -> str | None:
    if not pcm:
        return None
    config.RECORDINGS_DIR.mkdir(parents=True, exist_ok=True)
    samples = np.frombuffer(pcm, dtype=np.int16)
    try:
        # MP3 needs libsndfile 1.1+, which the soundfile wheels bundle.
        name = f"{call_id}.mp3"
        sf.write(config.RECORDINGS_DIR / name, samples, RECORDING_SAMPLE_RATE, format="MP3")
    except Exception as e:
        logger.warning(f"MP3 encoding failed ({e}), saving WAV instead")
        name = f"{call_id}.wav"
        sf.write(config.RECORDINGS_DIR / name, samples, RECORDING_SAMPLE_RATE, format="WAV")
    return name


async def run_call(connection: SmallWebRTCConnection, call_id: str, language: str):
    write_call_status(call_id, ended=False, recording=None)
    recording: dict[str, str | None] = {"file": None}

    try:
        agent = await fetch_agent_config(language)
    except Exception as e:
        logger.error(f"Call {call_id}: could not load the agent config from {config.APP_URL}: {e}")
        await connection.disconnect()
        write_call_status(call_id, ended=True, recording=None, error="agent config unavailable")
        return

    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(audio_in_enabled=True, audio_out_enabled=True),
    )

    stt = create_stt()
    llm = OpenAILLMService(
        api_key=config.LLM_API_KEY,
        base_url=config.LLM_BASE_URL,
        settings=OpenAILLMService.Settings(
            model=config.LLM_MODEL,
            system_instruction=agent.system_prompt,
            temperature=0.6,
            max_tokens=250,
            # Sarvam-30B thinks before answering by default; a voice call can't wait for that.
            extra={"extra_body": {"chat_template_kwargs": {"enable_thinking": False}}},
        ),
    )
    tts = IndicParlerTTSService(description=config.TTS_VOICE_HI if language == "hi" else config.TTS_VOICE_EN)

    context = LLMContext()
    user_aggregator, assistant_aggregator = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            # The caller's turn ends after VAD_STOP_SECS of silence. Speaking while the
            # bot talks interrupts it (VAD start strategy, interruptions on by default).
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=config.VAD_STOP_SECS)),
            user_turn_strategies=UserTurnStrategies(
                stop=[SpeechTimeoutUserTurnStopStrategy(user_speech_timeout=0.0)],
            ),
        ),
    )
    audiobuffer = AudioBufferProcessor(sample_rate=RECORDING_SAMPLE_RATE, num_channels=1, auto_start_recording=True)

    pipeline = Pipeline(
        [
            transport.input(),
            stt,
            user_aggregator,
            llm,
            ThinkingFilter(),
            tts,
            transport.output(),
            audiobuffer,
            GoodbyeDetector(agent.end_call_phrases),
            assistant_aggregator,
        ]
    )

    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=16000,
            audio_out_sample_rate=24000,
            enable_metrics=True,
        ),
        processor_unusable_policy=ProcessorUnusablePolicy.END,
    )
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    @worker.rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        # Fixed greeting, so the call starts speaking without waiting on the LLM.
        await worker.queue_frames([TTSSpeakFrame(agent.first_message)])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Call {call_id}: caller hung up")
        await audiobuffer.stop_recording()
        await runner.cancel()

    @audiobuffer.event_handler("on_audio_data")
    async def on_audio_data(buffer, audio, sample_rate, num_channels):
        recording["file"] = await asyncio.to_thread(save_recording, call_id, audio)

    async def hang_up_at_max_duration():
        await asyncio.sleep(agent.max_duration_seconds)
        logger.info(f"Call {call_id}: reached {agent.max_duration_seconds}s, ending")
        await worker.end(reason="max duration")

    timer = asyncio.create_task(hang_up_at_max_duration())
    try:
        await runner.run()
    finally:
        timer.cancel()
        write_call_status(call_id, ended=True, recording=recording["file"])
        logger.info(f"Call {call_id}: finished, recording={recording['file']}")
