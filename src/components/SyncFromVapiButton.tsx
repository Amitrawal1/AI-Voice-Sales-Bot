"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Shown when a saved call is missing its recording or AI summary; asks the server to check Vapi again.
export function SyncFromVapiButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function sync() {
    setState("loading");
    try {
      const res = await fetch(`/api/calls/${callId}/sync`, { method: "POST" });
      if (!res.ok) throw new Error();
      setState("idle");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={sync}
        disabled={state === "loading"}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
      >
        {state === "loading" ? "Checking Vapi…" : "Refresh results"}
      </button>
      {state === "error" && <span className="text-xs text-red-600">Could not reach Vapi.</span>}
    </div>
  );
}
