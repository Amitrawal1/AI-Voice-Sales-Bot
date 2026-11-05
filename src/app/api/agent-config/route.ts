import { NextResponse } from "next/server";
import { buildAgentConfig, isCallLanguage } from "@/lib/assistant";
import { isVoiceServerRequest } from "@/lib/voiceServer";

// The voice server loads the sales prompt from here at the start of each call,
// so product.ts stays the single place to edit the pitch.
export async function GET(req: Request) {
  if (!isVoiceServerRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const language = new URL(req.url).searchParams.get("language");
  if (!isCallLanguage(language)) return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  return NextResponse.json(buildAgentConfig(language));
}
