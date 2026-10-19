import "server-only";

type VapiCall = {
  status?: string;
  recordingUrl?: string;
  artifact?: { recordingUrl?: string; recording?: { mono?: { combinedUrl?: string } } };
};

export async function getRecordingUrl(callId: string): Promise<string | null> {
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) throw new Error("VAPI_PRIVATE_KEY is missing");

  const res = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vapi returned ${res.status} for call ${callId}`);

  const call = (await res.json()) as VapiCall;
  return call.artifact?.recordingUrl ?? call.artifact?.recording?.mono?.combinedUrl ?? call.recordingUrl ?? null;
}
