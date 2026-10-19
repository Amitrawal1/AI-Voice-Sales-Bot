import "server-only";
import { getSupabase } from "./supabase";
import type { CallRecord, SalesStatus } from "./types";

export async function listCalls(): Promise<CallRecord[]> {
  const { data, error } = await getSupabase()
    .from("calls")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data as CallRecord[];
}

export async function getCall(id: string): Promise<CallRecord | null> {
  const { data, error } = await getSupabase().from("calls").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CallRecord | null;
}

export function countByStatus(calls: CallRecord[]) {
  const counts = new Map<SalesStatus, number>();
  for (const c of calls) if (c.status) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  return counts;
}
