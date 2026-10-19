import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getRecordingUrl } from "@/lib/vapi";

export const maxDuration = 60;

const ATTEMPTS = 10;
const DELAY_MS = 3000;

// Vapi uploads the recording a few seconds after the call ends, so poll for it.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data: call, error } = await supabase
    .from("calls")
    .select("id, vapi_call_id, recording_url")
    .eq("id", id)
    .single();
  if (error || !call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (call.recording_url) return NextResponse.json({ recording_url: call.recording_url });
  if (!call.vapi_call_id) return NextResponse.json({ recording_url: null });

  try {
    for (let i = 0; i < ATTEMPTS; i++) {
      const url = await getRecordingUrl(call.vapi_call_id);
      if (url) {
        await supabase.from("calls").update({ recording_url: url }).eq("id", id);
        return NextResponse.json({ recording_url: url });
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  } catch (e) {
    console.error("Fetching recording failed", e);
    return NextResponse.json({ error: "Could not fetch the recording" }, { status: 502 });
  }
  return NextResponse.json({ recording_url: null });
}
