import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCall } from "@/lib/analyzeCall";
import { getSupabase } from "@/lib/supabase";

export const maxDuration = 60;

const CreateCallBody = z.object({
  callId: z.string().nullable(),
  language: z.string(),
  startedAt: z.string(),
  endedAt: z.string(),
  durationSec: z.number().int().nonnegative(),
  consent: z.literal(true),
  transcript: z.array(
    z.object({ role: z.enum(["assistant", "user"]), text: z.string(), at: z.string() }),
  ),
});

export async function GET() {
  const { data, error } = await getSupabase()
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const parsed = CreateCallBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid call data" }, { status: 400 });
  const body = parsed.data;
  const supabase = getSupabase();

  // Save the transcript first so the call is never lost, even if the analysis fails.
  const { data: row, error } = await supabase
    .from("calls")
    .insert({
      vapi_call_id: body.callId,
      language: body.language,
      started_at: body.startedAt,
      ended_at: body.endedAt,
      duration_sec: body.durationSec,
      transcript: body.transcript,
      consent_given: body.consent,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    const analysis = await analyzeCall(body.transcript);
    const { data: updated, error: updateError } = await supabase
      .from("calls")
      .update(analysis)
      .eq("id", row.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return NextResponse.json(updated);
  } catch (e) {
    console.error("Call analysis failed", e);
    return NextResponse.json({ ...row, analysisError: "AI summary could not be generated." });
  }
}
