"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Vapi from "@vapi-ai/web";
import { buildAssistant, type CallLanguage } from "@/lib/assistant";
import type { TranscriptLine } from "@/lib/types";

export type CallStatus = "idle" | "connecting" | "live" | "ending" | "ended" | "error";

export type FinishedCall = {
  callId: string | null;
  language: CallLanguage;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  transcript: TranscriptLine[];
};

type Partial = { role: TranscriptLine["role"]; text: string } | null;

type VapiTranscriptMessage = {
  type: "transcript";
  role: "assistant" | "user";
  transcriptType: "partial" | "final";
  transcript: string;
};

function isTranscript(msg: unknown): msg is VapiTranscriptMessage {
  return typeof msg === "object" && msg !== null && (msg as { type?: string }).type === "transcript";
}

export function useVoiceCall() {
  const vapiRef = useRef<Vapi | null>(null);
  const callIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const languageRef = useRef<CallLanguage>("en");
  const transcriptRef = useRef<TranscriptLine[]>([]);

  const [status, setStatus] = useState<CallStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [partial, setPartial] = useState<Partial>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [botSpeaking, setBotSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishedCall, setFinishedCall] = useState<FinishedCall | null>(null);

  // Final transcript chunks from the same speaker are merged into one chat bubble.
  const addFinal = useCallback((role: TranscriptLine["role"], text: string) => {
    const lines = transcriptRef.current;
    const last = lines[lines.length - 1];
    const next =
      last && last.role === role
        ? [...lines.slice(0, -1), { ...last, text: `${last.text} ${text}` }]
        : [...lines, { role, text, at: new Date().toISOString() }];
    transcriptRef.current = next;
    setTranscript(next);
  }, []);

  const getVapi = useCallback(async () => {
    if (vapiRef.current) return vapiRef.current;
    const key = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!key) throw new Error("NEXT_PUBLIC_VAPI_PUBLIC_KEY is missing in .env.local");

    // Imported lazily because the SDK touches browser-only APIs.
    const { default: VapiClient } = await import("@vapi-ai/web");
    const vapi = new VapiClient(key);

    vapi.on("call-start", () => {
      startedAtRef.current = Date.now();
      setStatus("live");
    });
    vapi.on("speech-start", () => setBotSpeaking(true));
    vapi.on("speech-end", () => setBotSpeaking(false));
    vapi.on("message", (msg: unknown) => {
      if (!isTranscript(msg) || !msg.transcript.trim()) return;
      if (msg.transcriptType === "partial") {
        setPartial({ role: msg.role, text: msg.transcript });
      } else {
        setPartial(null);
        addFinal(msg.role, msg.transcript.trim());
      }
    });
    vapi.on("call-end", () => {
      const started = startedAtRef.current;
      const ended = Date.now();
      setBotSpeaking(false);
      setPartial(null);
      setStatus((s) => (s === "error" ? s : "ended"));
      // A call that never connected has nothing to save.
      if (!started) return;
      setFinishedCall({
        callId: callIdRef.current,
        language: languageRef.current,
        startedAt: new Date(started).toISOString(),
        endedAt: new Date(ended).toISOString(),
        durationSec: Math.round((ended - started) / 1000),
        transcript: transcriptRef.current,
      });
    });
    vapi.on("error", (e: unknown) => {
      console.error("Vapi error", e);
      const message =
        (e as { error?: { message?: string } })?.error?.message ??
        (e as { message?: string })?.message ??
        "Something went wrong with the call.";
      setError(typeof message === "string" ? message : "Something went wrong with the call.");
      setStatus("error");
    });

    vapiRef.current = vapi;
    return vapi;
  }, [addFinal]);

  const start = useCallback(
    async (language: CallLanguage) => {
      setError(null);
      setFinishedCall(null);
      setTranscript([]);
      setPartial(null);
      setDurationSec(0);
      transcriptRef.current = [];
      callIdRef.current = null;
      startedAtRef.current = null;
      languageRef.current = language;
      setStatus("connecting");

      try {
        const vapi = await getVapi();
        const call = await vapi.start(buildAssistant(language));
        if (!call) throw new Error("Could not start the call. Check your microphone permission.");
        callIdRef.current = call.id;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start the call.");
        setStatus("error");
      }
    },
    [getVapi],
  );

  const end = useCallback(async () => {
    setStatus("ending");
    await vapiRef.current?.stop();
  }, []);

  // Call timer.
  useEffect(() => {
    if (status !== "live") return;
    const id = setInterval(() => {
      if (startedAtRef.current) setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [status]);

  // Hang up if the user navigates away mid-call.
  useEffect(() => {
    return () => {
      vapiRef.current?.stop();
      vapiRef.current?.removeAllListeners();
    };
  }, []);

  return { status, transcript, partial, durationSec, botSpeaking, error, finishedCall, start, end };
}
