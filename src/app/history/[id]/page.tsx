import Link from "next/link";
import { notFound } from "next/navigation";
import { CallInsights } from "@/components/CallInsights";
import { ChatTranscript } from "@/components/ChatTranscript";
import { FetchRecordingButton } from "@/components/FetchRecordingButton";
import { SetupNotice } from "@/components/SetupNotice";
import { getCall } from "@/lib/calls";
import { formatDateTime, formatDuration } from "@/lib/format";
import type { CallRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let call: CallRecord | null;
  try {
    call = await getCall(id);
  } catch (e) {
    return <SetupNotice message={e instanceof Error ? e.message : "Could not load the call."} />;
  }
  if (!call) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/history" className="text-sm text-indigo-600 hover:underline">
          ← Back to call history
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Call on {formatDateTime(call.started_at)}</h1>
        <p className="text-sm text-slate-500">
          Duration {formatDuration(call.duration_sec)} · {call.language === "hi" ? "Hindi" : "English"} ·{" "}
          {call.transcript.length} messages · Recording consent {call.consent_given ? "given" : "not recorded"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CallInsights
            call={call}
            recordingFallback={call.vapi_call_id ? <FetchRecordingButton callId={call.id} /> : undefined}
          />
        </section>

        <section className="flex max-h-[75vh] min-h-[320px] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-200 px-5 py-3 text-sm font-semibold">Transcript</h2>
          <div className="flex-1 overflow-y-auto p-5">
            <ChatTranscript
              lines={call.transcript}
              emptyText="No transcript was captured for this call."
              autoScroll={false}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
