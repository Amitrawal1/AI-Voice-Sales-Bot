"""Speech models shared by every call.

Whisper and Parler-TTS are loaded once when the server starts and reused by all calls,
so a new call doesn't spend seconds (and GPU memory) loading its own copy.
"""

import asyncio
import threading
from collections.abc import AsyncGenerator, Iterator

import numpy as np
import torch
from faster_whisper import WhisperModel
from loguru import logger
from parler_tts import ParlerTTSForConditionalGeneration, ParlerTTSStreamer
from transformers import AutoTokenizer, StoppingCriteria, StoppingCriteriaList

from pipecat.audio.utils import create_stream_resampler
from pipecat.frames.frames import ErrorFrame, Frame, TTSAudioRawFrame
from pipecat.services.settings import TTSSettings
from pipecat.services.tts_service import TTSService
from pipecat.services.whisper.stt import WhisperSTTService
from pipecat.transcriptions.language import Language

import config

_whisper: WhisperModel | None = None
_parler: "ParlerEngine | None" = None


def load_models():
    global _whisper, _parler
    logger.info(f"Loading Whisper from {config.WHISPER_MODEL_DIR}")
    _whisper = WhisperModel(
        config.WHISPER_MODEL_DIR, device=config.WHISPER_DEVICE, compute_type=config.WHISPER_COMPUTE_TYPE
    )
    logger.info(f"Loading {config.TTS_MODEL}")
    _parler = ParlerEngine(config.TTS_MODEL, config.TTS_DEVICE)
    logger.info("Speech models ready")


# --- Speech to text -------------------------------------------------------------------------


class SharedWhisperSTTService(WhisperSTTService):
    """Pipecat's faster-whisper service, but using the model loaded at startup."""

    def _load(self):
        if _whisper is None:
            raise RuntimeError("load_models() must run before a call starts")
        self._model = _whisper


def create_stt() -> SharedWhisperSTTService:
    return SharedWhisperSTTService(
        device=config.WHISPER_DEVICE,
        compute_type=config.WHISPER_COMPUTE_TYPE,
        settings=SharedWhisperSTTService.Settings(
            model=config.WHISPER_MODEL_DIR,
            # Apex is trained to output Hindi speech as romanised Hinglish when the
            # language is "en" (see its model card), and English speech stays English.
            language=Language.EN,
            hotwords="FlowCRM",
        ),
    )


# --- Text to speech -------------------------------------------------------------------------


class _StopWhenSet(StoppingCriteria):
    def __init__(self, event: threading.Event):
        self._event = event

    def __call__(self, input_ids, scores, **kwargs):
        return torch.full((input_ids.shape[0],), self._event.is_set(), dtype=torch.bool, device=input_ids.device)


class ParlerEngine:
    def __init__(self, model_name: str, device: str):
        self.device = device
        dtype = torch.bfloat16 if device.startswith("cuda") else torch.float32
        self.model = ParlerTTSForConditionalGeneration.from_pretrained(model_name).to(device, dtype=dtype)
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.description_tokenizer = AutoTokenizer.from_pretrained(self.model.config.text_encoder._name_or_path)
        self.sample_rate: int = self.model.audio_encoder.config.sampling_rate
        self.frame_rate: int = self.model.audio_encoder.config.frame_rate

    def stream(self, text: str, description: str, stop: threading.Event) -> Iterator[np.ndarray]:
        """Yield float32 audio chunks while the model is still generating. Runs in a worker thread."""
        streamer = ParlerTTSStreamer(
            self.model, device=self.device, play_steps=max(1, int(self.frame_rate * config.TTS_CHUNK_SECONDS))
        )
        desc = self.description_tokenizer(description, return_tensors="pt").to(self.device)
        prompt = self.tokenizer(text, return_tensors="pt").to(self.device)
        generation = threading.Thread(
            target=self.model.generate,
            kwargs=dict(
                input_ids=desc.input_ids,
                attention_mask=desc.attention_mask,
                prompt_input_ids=prompt.input_ids,
                prompt_attention_mask=prompt.attention_mask,
                streamer=streamer,
                do_sample=True,
                temperature=1.0,
                min_new_tokens=10,
                # Lets an interruption stop the GPU work instead of finishing the sentence unheard.
                stopping_criteria=StoppingCriteriaList([_StopWhenSet(stop)]),
            ),
            daemon=True,
        )
        generation.start()
        for chunk in streamer:
            if stop.is_set() or chunk.shape[0] == 0:
                break
            yield chunk


class IndicParlerTTSService(TTSService):
    """Streams Indic Parler-TTS audio into the pipeline, one sentence at a time."""

    def __init__(self, *, description: str, **kwargs):
        super().__init__(
            push_start_frame=True,
            push_stop_frames=True,
            settings=TTSSettings(model=config.TTS_MODEL, voice=None, language=None),
            **kwargs,
        )
        self._description = description
        self._resampler = create_stream_resampler()

    def can_generate_metrics(self) -> bool:
        return True

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        engine = _parler
        if engine is None:
            yield ErrorFrame(error="Parler-TTS is not loaded")
            return

        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()
        stop = threading.Event()
        done = object()

        def produce():
            try:
                for chunk in engine.stream(text, self._description, stop):
                    loop.call_soon_threadsafe(queue.put_nowait, chunk)
            except Exception as e:  # surfaced to the pipeline below
                loop.call_soon_threadsafe(queue.put_nowait, e)
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, done)

        await self.start_tts_usage_metrics(text)
        loop.run_in_executor(None, produce)
        try:
            while (item := await queue.get()) is not done:
                if isinstance(item, Exception):
                    yield ErrorFrame(error=f"Parler-TTS failed: {item}")
                    break
                await self.stop_ttfb_metrics()
                pcm = (np.clip(item, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
                audio = await self._resampler.resample(pcm, engine.sample_rate, self.sample_rate)
                yield TTSAudioRawFrame(audio=audio, sample_rate=self.sample_rate, num_channels=1, context_id=context_id)
        finally:
            # Runs on normal completion and when an interruption cancels this generator.
            stop.set()
            await self.stop_ttfb_metrics()
