import "server-only";
import { z } from "zod";
import { SALES_STATUSES, type CallAnalysis } from "./types";

const AnalysisSchema = z.object({
  summary: z.string(),
  requirements: z.array(z.string()),
  objections: z.array(z.string()),
  next_steps: z.array(z.string()),
  status: z.enum(SALES_STATUSES),
});

type VapiCall = {
  status?: string;
  recordingUrl?: string;
  artifact?: { recordingUrl?: string; recording?: { mono?: { combinedUrl?: string } } };
  analysis?: { structuredData?: unknown };
};

export type VapiCallResult = {
  ended: boolean;
  recordingUrl: string | null;
  analysis: CallAnalysis | null;
};

export async function getVapiCall(callId: string): Promise<VapiCallResult> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("VAPI_PRIVATE_KEY is missing");

  const res = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vapi returned ${res.status} for call ${callId}`);

  const call = (await res.json()) as VapiCall;
  const parsed = AnalysisSchema.safeParse(call.analysis?.structuredData);
  return {
    ended: call.status === "ended",
    recordingUrl: call.artifact?.recordingUrl ?? call.artifact?.recording?.mono?.combinedUrl ?? call.recordingUrl ?? null,
    analysis: parsed.success ? parsed.data : null,
  };
}
