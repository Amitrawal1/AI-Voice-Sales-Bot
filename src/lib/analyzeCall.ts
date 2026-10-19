import "server-only";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { CLAUDE_MODEL, getAnthropic } from "./anthropic";
import { PRODUCT } from "./product";
import { SALES_STATUSES, type SalesStatus, type TranscriptLine } from "./types";

const AnalysisSchema = z.object({
  summary: z.string().describe("2-4 sentence summary of the call"),
  requirements: z.array(z.string()).describe("What the customer needs or cares about"),
  objections: z.array(z.string()).describe("Concerns or objections the customer raised"),
  next_steps: z.array(z.string()).describe("Concrete follow-up actions for the sales team"),
  status: z.enum(SALES_STATUSES),
});

export type CallAnalysis = z.infer<typeof AnalysisSchema>;

const SYSTEM = `You analyse sales call transcripts for ${PRODUCT.name} (${PRODUCT.tagline}).
Write the summary and lists in English, even if the call was in Hindi. Keep each list item short. Use an empty list when nothing applies.

Pick exactly one status:
- Converted: the customer agreed to sign up, start the free trial, or buy.
- Demo Requested: the customer asked for or agreed to a demo at a time.
- Interested: positive and engaged, but no commitment yet.
- Follow-up Required: asked to be contacted later, needs to check with someone, or the call ended before a decision.
- Not Interested: clearly declined.
- No Response: the customer said nothing meaningful.
If both Converted and Demo Requested apply, choose Converted.`;

function formatTranscript(lines: TranscriptLine[]) {
  return lines.map((l) => `${l.role === "assistant" ? "Sales bot" : "Customer"}: ${l.text}`).join("\n");
}

export async function analyzeCall(transcript: TranscriptLine[]): Promise<CallAnalysis> {
  const customerWords = transcript
    .filter((l) => l.role === "user")
    .map((l) => l.text)
    .join(" ")
    .trim();

  // No need to ask the model when the customer never spoke.
  if (customerWords.split(/\s+/).filter(Boolean).length < 2) {
    return {
      summary: "The customer did not respond during the call.",
      requirements: [],
      objections: [],
      next_steps: ["Try calling the customer again at a different time."],
      status: "No Response" satisfies SalesStatus,
    };
  }

  const response = await getAnthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(AnalysisSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `<transcript>\n${formatTranscript(transcript)}\n</transcript>` }],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Call analysis failed (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}
