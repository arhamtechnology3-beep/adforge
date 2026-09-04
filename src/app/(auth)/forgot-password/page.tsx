'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Megaphone, ArrowLeft } from 'lucide-react';
import { isSupabaseUnreachable, SUPABASE_UNREACHABLE_MESSAGE } from '@/lib/auth/demo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/api/auth/callback?next=/reset-password`,
      });

      if (resetError) {
        setError(
          isSupabaseUnreachable(resetError)
            ? SUPABASE_UNREACHABLE_MESSAGE
            : resetError.message
        );
        setLoading(false);
        return;
      }

      setSent(true);
      setLoading(false);
    } catch (err: unknown) {
      setError(
        isSupabaseUnreachable(err)
          ? SUPABASE_UNREACHABLE_MESSAGE
          : err instanceof Error
            ? err.message
            : 'Could not send reset email.'
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
          <h2 className="text-2xl font-semibold mb-4">Reset your password</h2>
          <p className="text-white/70 leading-relaxed">
            We&apos;ll email you a secure link to choose a new password and get back into AdForge.
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

          <h2 className="text-2xl font-bold mb-2">Forgot password</h2>
          <p className="text-muted mb-8">
            Enter the email for your account and we&apos;ll send a reset link.
          </p>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
          )}

          {sent ? (
            <div className="bg-green-50 text-green-800 text-sm p-4 rounded-lg space-y-2">
              <p className="font-medium">Check your inbox</p>
              <p>
                If an account exists for <strong>{email}</strong>, a password reset link is on the
                way. The link expires after a short time.
              </p>
              <p className="text-green-700/80">
                Also check spam. After clicking the link you can set a new password.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
