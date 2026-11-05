"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BotOutputData, PipecatClient, TranscriptData } from "@pipecat-ai/client-js";
import type { CallLanguage } from "@/lib/assistant";
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

function iceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turn = process.env.NEXT_PUBLIC_TURN_URL;
  if (turn) {
    servers.push({
      urls: turn,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME,
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL,
    });
  }
  return servers;
}

// Browser side of a call to the Pipecat voice server (voice-server/), over WebRTC.
export function useVoiceCall() {
  const clientRef = useRef<PipecatClient | null>(null);
  const callIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const languageRef = useRef<CallLanguage>("en");
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const spokenSegmentsRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const onUserTranscript = useCallback(
    (data: TranscriptData) => {
      const text = data.text.trim();
      if (!text) return;
      if (data.final) {
        setPartial(null);
        addFinal("user", text);
      } else {
        setPartial({ role: "user", text });
      }
    },
    [addFinal],
  );

  // Each sentence is reported once it has been spoken, so interrupted text never shows up.
  const onBotOutput = useCallback(
    (data: BotOutputData) => {
      const done = data.spoken_status ? data.spoken_status === "completed" : data.spoken;
      if (!done) return;
      if (data.segment_id !== undefined) {
        if (spokenSegmentsRef.current.has(data.segment_id)) return;
        spokenSegmentsRef.current.add(data.segment_id);
      }
      const text = (data.spoken_progress?.accumulated_text || data.text).trim();
      if (text) addFinal("assistant", text);
    },
    [addFinal],
  );

  const finish = useCallback(() => {
    const started = startedAtRef.current;
    const ended = Date.now();
    clientRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setBotSpeaking(false);
    setPartial(null);
    setStatus((s) => (s === "error" ? s : "ended"));
    // A call that never connected has nothing to save.
    if (!started) return;
    startedAtRef.current = null;
    setFinishedCall({
      callId: callIdRef.current,
      language: languageRef.current,
      startedAt: new Date(started).toISOString(),
      endedAt: new Date(ended).toISOString(),
      durationSec: Math.round((ended - started) / 1000),
      transcript: transcriptRef.current,
    });
  }, []);

  const start = useCallback(
    async (language: CallLanguage) => {
      const serverUrl = process.env.NEXT_PUBLIC_VOICE_SERVER_URL?.replace(/\/$/, "");
      setError(null);
      setFinishedCall(null);
      setTranscript([]);
      setPartial(null);
      setDurationSec(0);
      transcriptRef.current = [];
      spokenSegmentsRef.current = new Set();
      callIdRef.current = crypto.randomUUID();
      startedAtRef.current = null;
      languageRef.current = language;

      if (!serverUrl) {
        setError("NEXT_PUBLIC_VOICE_SERVER_URL is missing in .env.local");
        setStatus("error");
        return;
      }
      setStatus("connecting");

      try {
        // Imported lazily because the SDK touches browser-only APIs.
        const [{ PipecatClient }, { SmallWebRTCTransport }] = await Promise.all([
          import("@pipecat-ai/client-js"),
          import("@pipecat-ai/small-webrtc-transport"),
        ]);
        const client = new PipecatClient({
          transport: new SmallWebRTCTransport({ iceServers: iceServers() }),
          enableMic: true,
          enableCam: false,
          callbacks: {
            onBotReady: () => {
              startedAtRef.current = Date.now();
              setStatus("live");
            },
            // Play the bot's voice.
            onTrackStarted: (track, participant) => {
              if (track.kind !== "audio" || participant?.local) return;
              const audio = audioRef.current ?? new Audio();
              audio.autoplay = true;
              audio.srcObject = new MediaStream([track]);
              audioRef.current = audio;
              audio.play().catch((e) => console.error("Could not play bot audio", e));
            },
            onBotStartedSpeaking: () => setBotSpeaking(true),
            onBotStoppedSpeaking: () => setBotSpeaking(false),
            onUserTranscript,
            onBotOutput,
            onDisconnected: finish,
            onError: (message) => {
              console.error("Voice server error", message);
              const data = message.data as { message?: string; fatal?: boolean } | undefined;
              if (data?.fatal === false) return;
              setError(data?.message ?? "Something went wrong with the call.");
              setStatus("error");
            },
            onDeviceError: () => {
              setError("Could not use the microphone. Check the browser permission.");
              setStatus("error");
            },
          },
        });
        clientRef.current = client;
        await client.connect({
          webrtcRequestParams: {
            endpoint: `${serverUrl}/api/offer`,
            requestData: { callId: callIdRef.current, language },
          },
        });
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : "Could not reach the voice server.");
        setStatus("error");
        await clientRef.current?.disconnect().catch(() => {});
      }
    },
    [finish, onBotOutput, onUserTranscript],
  );

  const end = useCallback(async () => {
    setStatus("ending");
    if (clientRef.current) await clientRef.current.disconnect();
    else finish();
  }, [finish]);

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
      clientRef.current?.disconnect();
    };
  }, []);

  return { status, transcript, partial, durationSec, botSpeaking, error, finishedCall, start, end };
}
