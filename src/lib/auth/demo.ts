export function isSupabaseUnreachable(err: unknown): boolean {
  if (!err) return false;
  const value = err as { message?: string; name?: string };
  const message = (value.message || '').toLowerCase();
  return (
    message === 'failed to fetch' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed') ||
    value.name === 'TypeError' ||
    value.name === 'AuthRetryableFetchError'
  );
}

export const SUPABASE_UNREACHABLE_MESSAGE =
  'Cannot reach Supabase (the project URL in NEXT_PUBLIC_SUPABASE_URL does not resolve). Use Demo Mode for local preview, or restore the project in the Supabase dashboard.';

export async function startDemoSession(): Promise<boolean> {
  const res = await fetch('/api/auth/demo', { method: 'POST' });
  return res.ok;
}

export async function enterDemoIfOffline(
  err: unknown,
  goToDashboard: () => void
): Promise<boolean> {
  if (!isSupabaseUnreachable(err)) return false;
  const started = await startDemoSession();
  if (!started) return false;
  goToDashboard();
  return true;
}
