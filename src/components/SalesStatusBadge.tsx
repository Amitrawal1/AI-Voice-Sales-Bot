import type { SalesStatus } from "@/lib/types";

const STYLES: Record<SalesStatus, string> = {
  Converted: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Demo Requested": "bg-violet-100 text-violet-800 ring-violet-200",
  Interested: "bg-sky-100 text-sky-800 ring-sky-200",
  "Follow-up Required": "bg-amber-100 text-amber-800 ring-amber-200",
  "Not Interested": "bg-red-100 text-red-700 ring-red-200",
  "No Response": "bg-slate-100 text-slate-600 ring-slate-200",
};

export function SalesStatusBadge({ status }: { status: SalesStatus | null }) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        Not analysed
      </span>
    );
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${STYLES[status]}`}>
      {status}
    </span>
  );
}
