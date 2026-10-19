import type { CreateAssistantDTO } from "@vapi-ai/web/dist/api";
import { PRODUCT } from "./product";

export type CallLanguage = "en" | "hi";

export const LANGUAGES: { value: CallLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi (Hinglish)" },
];

function systemPrompt(language: CallLanguage) {
  const p = PRODUCT;
  const languageRule =
    language === "hi"
      ? "Speak in natural conversational Hinglish (Hindi mixed with common English words), written in Roman script. If the customer switches to English, switch with them."
      : "Speak in clear, friendly English.";

  return `You are Priya, a friendly and confident sales executive at ${p.name} on a live voice call with a potential customer.

PRODUCT
${p.name} — ${p.tagline}.
${p.description}
Features:
${p.features.map((f) => `- ${f}`).join("\n")}
Pricing:
${p.pricing.map((t) => `- ${t.plan}: ${t.price} (${t.details})`).join("\n")}
Current offer: ${p.offer}

OBJECTION HANDLING
${Object.entries(p.objections).map(([k, v]) => `- If "${k}": ${v}`).join("\n")}

CALL FLOW
1. You have already greeted them and mentioned the call is recorded. Ask for their name and what their business does.
2. Ask one or two questions about how they manage leads and follow-ups today, and what is painful.
3. Explain only the features that match their pain. Do not list everything.
4. Answer questions honestly. If you don't know something, say a specialist will follow up.
5. Handle objections calmly using the points above.
6. Try to close: offer the free trial sign-up, or book a demo. Confirm a time or an email if they agree.
7. If they are clearly not interested, thank them politely and end the call.

STYLE RULES
- ${languageRule}
- This is a voice call: keep every reply to 1–3 short sentences. Never use lists, markdown, emojis or symbols.
- Say prices in words a person would say out loud, for example "nine ninety nine rupees per month".
- Ask only one question at a time and let the customer talk.
- Never be pushy or make up features, discounts or facts.`;
}

export function buildAssistant(language: CallLanguage): CreateAssistantDTO {
  const hindi = language === "hi";
  return {
    name: `${PRODUCT.name} Sales Bot`,
    firstMessage: hindi
      ? `Namaste! Main Priya bol rahi hoon ${PRODUCT.name} se. Quality ke liye yeh call record ho rahi hai. Kya aapke paas do minute hain?`
      : `Hi! This is Priya from ${PRODUCT.name}. Just so you know, this call is recorded for quality purposes. Do you have two minutes?`,
    model: {
      provider: "anthropic",
      model: "claude-sonnet-5",
      temperature: 0.6,
      maxTokens: 250,
      messages: [{ role: "system", content: systemPrompt(language) }],
    },
    // Azure Swara is a native Hindi voice; Vapi "Neha" is an Indian-English voice.
    voice: hindi
      ? { provider: "azure", voiceId: "hi-IN-SwaraNeural" }
      : { provider: "vapi", voiceId: "Neha" },
    transcriber: hindi
      ? { provider: "deepgram", model: "nova-3", language: "multi" }
      : { provider: "deepgram", model: "nova-3", language: "en" },
    artifactPlan: { recordingEnabled: true, recordingFormat: "mp3" },
    endCallPhrases: ["goodbye", "bye bye", "have a great day", "alvida"],
    endCallMessage: hindi ? "Dhanyavaad, aapka din shubh ho!" : "Thanks for your time, have a great day!",
    maxDurationSeconds: 600,
  };
}
