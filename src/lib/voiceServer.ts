import "server-only";

function settings() {
  const url = process.env.VOICE_SERVER_URL?.replace(/\/$/, "");
  const secret = process.env.VOICE_SERVER_SECRET;
  if (!url) throw new Error("VOICE_SERVER_URL is missing");
  if (!secret) throw new Error("VOICE_SERVER_SECRET is missing");
  return { url, secret };
}

// True when a request carries the secret shared with the voice server.
export function isVoiceServerRequest(req: Request) {
  const secret = process.env.VOICE_SERVER_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

export type VoiceServerCall = { ended: boolean; recordingUrl: string | null };

// The voice server writes the recording a moment after the call ends.
export async function getVoiceServerCall(callId: string): Promise<VoiceServerCall | null> {
  const { url, secret } = settings();
  const res = await fetch(`${url}/calls/${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Voice server returned ${res.status} for call ${callId}`);
  return (await res.json()) as VoiceServerCall;
}
