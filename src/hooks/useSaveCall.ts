"use client";

import { useEffect, useState } from "react";
import type { FinishedCall } from "./useVoiceCall";
import type { CallRecord } from "@/lib/types";

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "saved"; call: CallRecord; syncing: boolean; syncError?: string }
  | { phase: "error"; message: string };

// Saves a finished call, then waits for Vapi's recording and AI analysis.
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

        const call = data as CallRecord;
        const needsSync = Boolean(call.vapi_call_id);
        setState({ phase: "saved", call, syncing: needsSync });
        if (!needsSync) return;

        const syncRes = await fetch(`/api/calls/${call.id}/sync`, { method: "POST" });
        const synced = await syncRes.json();
        if (cancelled) return;
        setState(
          syncRes.ok
            ? { phase: "saved", call: synced as CallRecord, syncing: false }
            : { phase: "saved", call, syncing: false, syncError: synced.error ?? "Could not get the call results" },
        );
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
