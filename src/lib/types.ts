export const SALES_STATUSES = [
  "Converted",
  "Interested",
  "Follow-up Required",
  "Not Interested",
  "Demo Requested",
  "No Response",
] as const;

export type SalesStatus = (typeof SALES_STATUSES)[number];

export type TranscriptLine = {
  role: "assistant" | "user";
  text: string;
  at: string;
};

export type CallRecord = {
  id: string;
  vapi_call_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_sec: number;
  language: string;
  transcript: TranscriptLine[];
  recording_url: string | null;
  summary: string | null;
  requirements: string[];
  objections: string[];
  next_steps: string[];
  status: SalesStatus | null;
  consent_given: boolean;
  created_at: string;
};
