export function SetupNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-semibold">Call history is not available</p>
      <p className="mt-1">{message}</p>
      <p className="mt-2 text-amber-800">
        Check the Supabase keys in <code>.env.local</code> and that <code>supabase/schema.sql</code> has been run.
      </p>
    </div>
  );
}
