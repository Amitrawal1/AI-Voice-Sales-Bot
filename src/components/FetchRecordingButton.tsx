"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Shown when a saved call has no recording yet; asks the server to check Vapi again.
export function FetchRecordingButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "missing" | "error">("idle");

  async function fetchRecording() {
    setState("loading");
    try {
      const res = await fetch(`/api/calls/${callId}/recording`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { recording_url: string | null };
      if (data.recording_url) router.refresh();
      else setState("missing");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={fetchRecording}
        disabled={state === "loading"}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
      >
        {state === "loading" ? "Checking…" : "Fetch recording"}
      </button>
      {state === "missing" && <span className="text-xs text-slate-500">Still not ready. Try again shortly.</span>}
      {state === "error" && <span className="text-xs text-red-600">Could not reach Vapi.</span>}
    </div>
  );
}
