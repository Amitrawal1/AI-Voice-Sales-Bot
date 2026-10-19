import type { CallStatus } from "@/hooks/useVoiceCall";

const STYLES: Record<CallStatus, { label: string; className: string; dot: string }> = {
  idle: { label: "Ready", className: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
  connecting: { label: "Connecting…", className: "bg-amber-100 text-amber-800", dot: "bg-amber-500 animate-pulse" },
  live: { label: "Live", className: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-500 animate-pulse" },
  ending: { label: "Ending…", className: "bg-amber-100 text-amber-800", dot: "bg-amber-500" },
  ended: { label: "Call ended", className: "bg-slate-100 text-slate-700", dot: "bg-slate-500" },
  error: { label: "Error", className: "bg-red-100 text-red-700", dot: "bg-red-500" },
};

export function CallStatusBadge({ status }: { status: CallStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}>
      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
