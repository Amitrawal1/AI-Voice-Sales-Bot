import { NextResponse } from "next/server";
import { analyzeTranscript } from "@/lib/llm";
import { getSupabase } from "@/lib/supabase";
import type { CallRecord } from "@/lib/types";
import { getVoiceServerCall } from "@/lib/voiceServer";

export const maxDuration = 60;

const ATTEMPTS = 8;
const DELAY_MS = 1500;

// Fills in what isn't known when the call is saved: the recording (written by the voice
// server a moment after hang-up) and the summary + sales status (from Sarvam-30B).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabase();

  const { data, error } = await supabase.from("calls").select("*").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  let call = data as CallRecord;
  if (!call.call_id || (call.recording_url && call.status)) return NextResponse.json(call);

  const save = async (update: Partial<CallRecord>) => {
    const { data: updated, error: updateError } = await supabase
      .from("calls")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;
    call = updated as CallRecord;
  };

  const problems: string[] = [];

  if (!call.status) {
    try {
      await save(await analyzeTranscript(call.transcript));
    } catch (e) {
      console.error("Call analysis failed", e);
      problems.push("the summary");
    }
  }

  if (!call.recording_url) {
    try {
      for (let i = 0; i < ATTEMPTS; i++) {
        const result = await getVoiceServerCall(call.call_id);
        if (result?.recordingUrl) {
          await save({ recording_url: result.recordingUrl });
          break;
        }
        if (result?.ended) break; // ended without a recording
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } catch (e) {
      console.error("Fetching the recording failed", e);
      problems.push("the recording");
    }
  }

  if (problems.length > 0) {
    return NextResponse.json({ error: `Could not get ${problems.join(" or ")}` }, { status: 502 });
  }
  return NextResponse.json(call);
}
