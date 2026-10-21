import type { StructuredDataPlan } from "@vapi-ai/web/dist/api";
import { PRODUCT } from "./product";
import { SALES_STATUSES, type CallAnalysis, type TranscriptLine } from "./types";

// Vapi runs this analysis at the end of every call, using the same credits as the call itself.

const PROMPT = `You analyse sales call transcripts for ${PRODUCT.name} (${PRODUCT.tagline}).
Write everything in English, even if the call was in Hindi. Keep each list item short. Use an empty list when nothing applies.

Fields:
- summary: 2-4 sentence summary of the call.
- requirements: what the customer needs or cares about.
- objections: concerns or objections the customer raised.
- next_steps: concrete follow-up actions for the sales team.
- status: exactly one of the values below.

Status rules:
- Converted: the customer agreed to sign up, start the free trial, or buy.
- Demo Requested: the customer asked for or agreed to a demo.
- Interested: positive and engaged, but no commitment yet.
- Follow-up Required: asked to be contacted later, needs to check with someone, or the call ended before a decision.
- Not Interested: clearly declined.
- No Response: the customer said nothing meaningful.
If both Converted and Demo Requested apply, choose Converted.

JSON Schema:
{{schema}}

Respond with only the JSON.`;

export const structuredDataPlan: StructuredDataPlan = {
  enabled: true,
  timeoutSeconds: 30,
  schema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      requirements: { type: "array", items: { type: "string" } },
      objections: { type: "array", items: { type: "string" } },
      next_steps: { type: "array", items: { type: "string" } },
      status: { type: "string", enum: [...SALES_STATUSES] },
    },
    required: ["summary", "requirements", "objections", "next_steps", "status"],
  },
  messages: [
    { role: "system", content: PROMPT },
    { role: "user", content: "Here is the transcript:\n\n{{transcript}}\n\nThe call ended because: {{endedReason}}" },
  ],
};

// No need to analyse a call where the customer never spoke.
export function noResponseAnalysis(transcript: TranscriptLine[]): CallAnalysis | null {
  const words = transcript
    .filter((l) => l.role === "user")
    .flatMap((l) => l.text.split(/\s+/))
    .filter(Boolean);
  if (words.length >= 2) return null;
  return {
    summary: "The customer did not respond during the call.",
    requirements: [],
    objections: [],
    next_steps: ["Try calling the customer again at a different time."],
    status: "No Response",
  };
}
