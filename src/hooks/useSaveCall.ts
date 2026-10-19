"use client";

import { useEffect, useState } from "react";
import type { FinishedCall } from "./useVoiceCall";
import type { CallRecord } from "@/lib/types";

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; call: CallRecord; recordingPending: boolean; analysisError?: string }
  | { phase: "error"; message: string };

// Saves a finished call, gets the AI analysis, then waits for the recording.
export function useSaveCall(finished: FinishedCall | null) {
  const [state, setState] = useState<SaveState>({ phase: "idle" });

  useEffect(() => {
    if (!finished) {
      setState({ phase: "idle" });
      return;
    }
    let cancelled = false;

    (async () => {
      setState({ phase: "saving" });
      try {
        const res = await fetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...finished, consent: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not save the call");
        if (cancelled) return;

        const call = data as CallRecord & { analysisError?: string };
        const hasRecording = Boolean(call.vapi_call_id);
        setState({ phase: "saved", call, recordingPending: hasRecording, analysisError: call.analysisError });
        if (!hasRecording) return;

        const recRes = await fetch(`/api/calls/${call.id}/recording`, { method: "POST" });
        const rec = recRes.ok ? ((await recRes.json()) as { recording_url: string | null }) : { recording_url: null };
        if (cancelled) return;
        setState({
          phase: "saved",
          call: { ...call, recording_url: rec.recording_url },
          recordingPending: false,
          analysisError: call.analysisError,
        });
      } catch (e) {
        if (!cancelled) setState({ phase: "error", message: e instanceof Error ? e.message : "Could not save the call" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [finished]);

  return state;
}
