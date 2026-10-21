import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import type { CallRecord } from "@/lib/types";
import { getVapiCall } from "@/lib/vapi";

export const maxDuration = 60;

const ATTEMPTS = 15;
const DELAY_MS = 3000;

// Vapi finishes the recording and the AI analysis a few seconds after the call ends, so poll for both.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase.from("calls").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  let call = data as CallRecord;
  if (!call.vapi_call_id || (call.recording_url && call.status)) return NextResponse.json(call);

  try {
    for (let i = 0; i < ATTEMPTS; i++) {
      const vapi = await getVapiCall(call.vapi_call_id!);
      const update = {
        ...(!call.recording_url && vapi.recordingUrl ? { recording_url: vapi.recordingUrl } : {}),
        ...(!call.status && vapi.analysis ? vapi.analysis : {}),
      };
      if (Object.keys(update).length > 0) {
        const { data: updated, error: updateError } = await supabase
          .from("calls")
          .update(update)
          .eq("id", id)
          .select()
          .single();
        if (updateError) throw updateError;
        call = updated as CallRecord;
      }
      if (call.recording_url && call.status) break;
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  } catch (e) {
    console.error("Syncing call from Vapi failed", e);
    return NextResponse.json({ error: "Could not get the call results from Vapi" }, { status: 502 });
  }
  return NextResponse.json(call);
}
