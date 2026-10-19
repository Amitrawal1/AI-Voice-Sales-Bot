import Link from "next/link";
import { SalesStatusBadge } from "@/components/SalesStatusBadge";
import { SetupNotice } from "@/components/SetupNotice";
import { countByStatus, listCalls } from "@/lib/calls";
import { formatDateTime, formatDuration } from "@/lib/format";
import { SALES_STATUSES, type CallRecord, type SalesStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function isStatus(value: string | undefined): value is SalesStatus {
  return SALES_STATUSES.includes(value as SalesStatus);
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = isStatus(status) ? status : null;

  let calls: CallRecord[];
  try {
    calls = await listCalls();
  } catch (e) {
    return <SetupNotice message={e instanceof Error ? e.message : "Could not load calls."} />;
  }

  const counts = countByStatus(calls);
  const shown = filter ? calls.filter((c) => c.status === filter) : calls;

  const chip = (label: string, href: string, active: boolean, count: number) => (
    <Link
      key={label}
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
        active ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {label} <span className={active ? "text-indigo-100" : "text-slate-400"}>{count}</span>
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Call history</h1>
          <p className="text-sm text-slate-500">Every call with its recording, transcript, AI summary and status.</p>
        </div>
        <Link href="/" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          New call
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {chip("All", "/history", !filter, calls.length)}
        {SALES_STATUSES.map((s) =>
          chip(s, `/history?status=${encodeURIComponent(s)}`, filter === s, counts.get(s) ?? 0),
        )}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {calls.length === 0 ? "No calls yet. Start a call to see it here." : "No calls with this status."}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                href={`/history/${c.id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-medium">{formatDateTime(c.started_at)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600">{formatDuration(c.duration_sec)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{c.language === "hi" ? "Hindi" : "English"}</span>
                    {c.recording_url && <span title="Recording available">🎧</span>}
                  </div>
                  <SalesStatusBadge status={c.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.summary ?? "No summary available."}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
