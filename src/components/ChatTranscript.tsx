"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/types";

type Props = {
  lines: TranscriptLine[];
  partial?: { role: TranscriptLine["role"]; text: string } | null;
  emptyText?: string;
};

function Bubble({ role, text, live }: { role: TranscriptLine["role"]; text: string; live?: boolean }) {
  const bot = role === "assistant";
  return (
    <div className={`flex ${bot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
          bot ? "rounded-bl-sm bg-slate-100 text-slate-900" : "rounded-br-sm bg-indigo-600 text-white"
        } ${live ? "opacity-60" : ""}`}
      >
        <p className={`mb-0.5 text-[11px] font-medium ${bot ? "text-slate-500" : "text-indigo-200"}`}>
          {bot ? "AI Bot (Priya)" : "Customer"}
          {live && " · speaking…"}
        </p>
        {text}
      </div>
    </div>
  );
}

export function ChatTranscript({ lines, partial, emptyText = "The conversation will appear here." }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines, partial]);

  if (lines.length === 0 && !partial) {
    return <p className="grid h-full place-items-center text-sm text-slate-400">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {lines.map((l, i) => (
        <Bubble key={i} role={l.role} text={l.text} />
      ))}
      {partial && <Bubble role={partial.role} text={partial.text} live />}
      <div ref={endRef} />
    </div>
  );
}
