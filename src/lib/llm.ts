import "server-only";
import { ANALYSIS_JSON_SCHEMA, ANALYSIS_PROMPT, AnalysisSchema, formatTranscript } from "./analysis";
import type { CallAnalysis, TranscriptLine } from "./types";

// Post-call summary and sales status from the self-hosted Sarvam-30B (vLLM, OpenAI-compatible API).
export async function analyzeTranscript(transcript: TranscriptLine[]): Promise<CallAnalysis> {
  const baseUrl = process.env.LLM_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("LLM_BASE_URL is missing");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_API_KEY ?? "EMPTY"}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL ?? "sarvamai/sarvam-30b",
      messages: [
        { role: "system", content: ANALYSIS_PROMPT },
        { role: "user", content: `Here is the transcript:\n\n${formatTranscript(transcript)}` },
      ],
      temperature: 0.2,
      max_tokens: 800,
      response_format: {
        type: "json_schema",
        json_schema: { name: "call_analysis", schema: ANALYSIS_JSON_SCHEMA },
      },
      chat_template_kwargs: { enable_thinking: false },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`LLM returned ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  // Safety net in case a reasoning block slips through.
  const json = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return AnalysisSchema.parse(JSON.parse(json));
}
