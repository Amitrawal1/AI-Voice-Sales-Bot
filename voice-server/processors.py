"""Small pipeline processors for the sales call."""

import re

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    EndWorkerFrame,
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    TTSTextFrame,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

OPEN, CLOSE = "<think>", "</think>"


def _partial_tag_len(text: str, tag: str) -> int:
    """Length of the longest end of `text` that could be the start of `tag`."""
    for n in range(min(len(text), len(tag) - 1), 0, -1):
        if tag.startswith(text[-n:]):
            return n
    return 0


class ThinkingFilter(FrameProcessor):
    """Drops <think>…</think> blocks from the LLM stream so reasoning is never spoken.

    Thinking is switched off in the request, so this is only a safety net in case the
    model or chat template emits a reasoning block anyway.
    """

    def __init__(self):
        super().__init__()
        self._buffer = ""
        self._thinking = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMFullResponseStartFrame):
            self._buffer, self._thinking = "", False
        elif isinstance(frame, LLMTextFrame):
            text = self._filter(frame.text)
            if text:
                await self.push_frame(LLMTextFrame(text), direction)
            return
        elif isinstance(frame, LLMFullResponseEndFrame):
            if self._buffer and not self._thinking:
                await self.push_frame(LLMTextFrame(self._buffer), direction)
            self._buffer, self._thinking = "", False

        await self.push_frame(frame, direction)

    def _filter(self, chunk: str) -> str:
        self._buffer += chunk
        out = ""
        while True:
            if self._thinking:
                i = self._buffer.find(CLOSE)
                if i < 0:
                    keep = _partial_tag_len(self._buffer, CLOSE)
                    self._buffer = self._buffer[-keep:] if keep else ""
                    return out
                self._buffer = self._buffer[i + len(CLOSE) :].lstrip()
                self._thinking = False
            else:
                i = self._buffer.find(OPEN)
                if i < 0:
                    keep = _partial_tag_len(self._buffer, OPEN)
                    out += self._buffer[: len(self._buffer) - keep]
                    self._buffer = self._buffer[len(self._buffer) - keep :]
                    return out
                out += self._buffer[:i]
                self._buffer = self._buffer[i + len(OPEN) :]
                self._thinking = True


class GoodbyeDetector(FrameProcessor):
    """Ends the call once the bot has finished saying one of the goodbye phrases.

    Place it after transport.output() so it sees what was actually spoken.
    """

    def __init__(self, phrases: list[str]):
        super().__init__()
        self._pattern = re.compile("|".join(re.escape(p) for p in phrases), re.IGNORECASE) if phrases else None
        self._spoken = ""
        self._ending = False

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, (BotStartedSpeakingFrame, InterruptionFrame)):
            self._spoken = ""
        elif isinstance(frame, TTSTextFrame):
            self._spoken += f" {frame.text}"

        await self.push_frame(frame, direction)

        if (
            isinstance(frame, BotStoppedSpeakingFrame)
            and self._pattern
            and not self._ending
            and self._pattern.search(self._spoken)
        ):
            self._ending = True
            await self.push_frame(EndWorkerFrame(reason="goodbye"))
