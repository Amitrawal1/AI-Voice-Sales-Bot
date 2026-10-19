"use client";

import { useState } from "react";
import { useVoiceCall } from "@/hooks/useVoiceCall";
import { LANGUAGES, type CallLanguage } from "@/lib/assistant";
import { formatDuration } from "@/lib/format";
import { PRODUCT } from "@/lib/product";
import { CallStatusBadge } from "./CallStatusBadge";
import { ChatTranscript } from "./ChatTranscript";

export function CallScreen() {
  const call = useVoiceCall();
  const [language, setLanguage] = useState<CallLanguage>("en");
  const [consent, setConsent] = useState(false);

  const inCall = call.status === "connecting" || call.status === "live" || call.status === "ending";

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      {/* Call controls */}
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Sales call</h1>
          <CallStatusBadge status={call.status} />
        </div>

        <div className="rounded-xl bg-slate-50 py-6 text-center">
          <p className="font-mono text-4xl font-semibold tabular-nums">{formatDuration(call.durationSec)}</p>
          <p className="mt-2 h-5 text-xs text-slate-500">
            {call.status === "live" && (call.botSpeaking ? "🔊 Priya is speaking…" : "🎙️ Listening to you…")}
            {call.status === "connecting" && "Allow microphone access if asked"}
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Language</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as CallLanguage)}
            disabled={inCall}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 disabled:opacity-60"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={inCall}
            className="mt-0.5 h-4 w-4 accent-indigo-600"
          />
          <span>
            I agree that this call will be <strong>recorded</strong> and transcribed, and that an AI summary will be
            saved.
          </span>
        </label>

        {inCall ? (
          <button
            onClick={call.end}
            disabled={call.status === "ending"}
            className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            End Call
          </button>
        ) : (
          <button
            onClick={() => call.start(language)}
            disabled={!consent}
            className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {call.status === "ended" ? "Start New Call" : "Start Call"}
          </button>
        )}
        {!consent && !inCall && (
          <p className="-mt-3 text-center text-xs text-slate-500">Tick the recording consent to start.</p>
        )}

        {call.error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{call.error}</p>}

        {call.finishedCall && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            Call ended after <strong>{formatDuration(call.finishedCall.durationSec)}</strong> with{" "}
            {call.finishedCall.transcript.length} messages.
          </div>
        )}

        <details className="text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-slate-700">What is {PRODUCT.name}?</summary>
          <p className="mt-2">{PRODUCT.description}</p>
          <p className="mt-2 text-xs text-slate-500">Try asking about pricing, WhatsApp follow-ups, or saying it is too expensive.</p>
        </details>
      </section>

      {/* Live chat */}
      <section className="flex h-[70vh] min-h-[420px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold">Live conversation</h2>
          <span className="text-xs text-slate-500">{call.transcript.length} messages</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <ChatTranscript
            lines={call.transcript}
            partial={call.partial}
            emptyText={inCall ? "Waiting for the conversation to start…" : "Press Start Call and talk to the AI salesperson."}
          />
        </div>
      </section>
    </div>
  );
}
