import type { ReactNode } from "react";
import type { CallRecord } from "@/lib/types";
import { SalesStatusBadge } from "./SalesStatusBadge";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">None</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-5 text-sm text-slate-700">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Recording player, AI summary and sales status for one call. Reused on the history page.
export function CallInsights({
  call,
  pending,
  refreshAction,
}: {
  call: CallRecord;
  pending?: boolean;
  refreshAction?: ReactNode;
}) {
  const missing = !call.recording_url || !call.status;
  const waiting = <p className="text-sm text-slate-400">Processing…</p>;

  return (
    <div className="space-y-4">
      {missing && !pending && refreshAction && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          <span>Some results are not ready yet.</span>
          {refreshAction}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Sales status</h3>
        <SalesStatusBadge status={call.status} pending={pending} />
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Recording</h4>
        {call.recording_url ? (
          <audio controls src={call.recording_url} className="w-full" preload="metadata" />
        ) : pending ? (
          waiting
        ) : (
          <p className="text-sm text-slate-400">Recording not available.</p>
        )}
      </div>

      <div>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">AI summary</h4>
        {!call.summary && pending ? (
          waiting
        ) : (
          <p className="text-sm leading-relaxed text-slate-700">{call.summary ?? "No summary available."}</p>
        )}
      </div>

      <List title="Customer requirements" items={call.requirements} />
      <List title="Objections" items={call.objections} />
      <List title="Next steps" items={call.next_steps} />
    </div>
  );
}
