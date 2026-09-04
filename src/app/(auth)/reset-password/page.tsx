'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Megaphone, ArrowLeft } from 'lucide-react';
import { isSupabaseUnreachable, SUPABASE_UNREACHABLE_MESSAGE } from '@/lib/auth/demo';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        // Prefer recovery session from email link (PKCE callback already exchanged)
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setHasSession(!!data.session);
          setChecking(false);
        }
      } catch {
        if (!cancelled) {
          setHasSession(false);
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(
          isSupabaseUnreachable(updateError)
            ? SUPABASE_UNREACHABLE_MESSAGE
            : updateError.message
        );
        setLoading(false);
        return;
      }
      setDone(true);
      setLoading(false);
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      setError(
        isSupabaseUnreachable(err)
          ? SUPABASE_UNREACHABLE_MESSAGE
          : err instanceof Error
            ? err.message
            : 'Could not update password.'
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1a1a2e] via-[#2d1b69] to-primary items-center justify-center p-12">
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-light to-accent flex items-center justify-center">
              <Megaphone className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold">Meta Ads</h1>
          </div>
          <h2 className="text-2xl font-semibold mb-4">Choose a new password</h2>
          <p className="text-white/70 leading-relaxed">
            Use a strong password you haven&apos;t used elsewhere. You&apos;ll stay signed in after
            saving.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>

          <h2 className="text-2xl font-bold mb-2">Set new password</h2>
          <p className="text-muted mb-8">Enter and confirm your new password below.</p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
          )}

          {checking ? (
            <p className="text-sm text-muted">Checking reset link…</p>
          ) : !hasSession ? (
            <div className="bg-amber-50 text-amber-900 text-sm p-4 rounded-lg space-y-3">
              <p>
                This reset link is missing or expired. Request a new one from the forgot password
                page.
              </p>
              <Link href="/forgot-password" className="text-primary font-medium hover:underline">
                Request new reset link
              </Link>
            </div>
          ) : done ? (
            <div className="bg-green-50 text-green-800 text-sm p-4 rounded-lg">
              Password updated. Redirecting to your dashboard…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New password</label>
                <input
                  type="password"
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="label">Confirm password</label>
                <input
                  type="password"
                  className="input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
