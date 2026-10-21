import { NextResponse } from "next/server";
import { z } from "zod";
import { noResponseAnalysis } from "@/lib/analysis";
import { getSupabase } from "@/lib/supabase";

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

export async function POST(req: Request) {
  const parsed = CreateCallBody.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid call data" }, { status: 400 });
  const body = parsed.data;

  const { data: row, error } = await getSupabase()
    .from("calls")
    .insert({
      vapi_call_id: body.callId,
      language: body.language,
      started_at: body.startedAt,
      ended_at: body.endedAt,
      duration_sec: body.durationSec,
      transcript: body.transcript,
      consent_given: body.consent,
      // The AI analysis comes from Vapi later; a silent call is classified right away.
      ...noResponseAnalysis(body.transcript),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(row);
}
