'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Megaphone, Mail, Phone } from 'lucide-react';
import {
  isSupabaseUnreachable,
  enterDemoIfOffline,
  startDemoSession,
  SUPABASE_UNREACHABLE_MESSAGE,
} from '@/lib/auth/demo';

export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function goToDashboard() {
    router.push('/dashboard');
    router.refresh();
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) {
        if (await enterDemoIfOffline(error, goToDashboard)) return;
        setError(isSupabaseUnreachable(error) ? SUPABASE_UNREACHABLE_MESSAGE : error.message);
        setLoading(false);
        return;
      }

      goToDashboard();
    } catch (err: unknown) {
      if (await enterDemoIfOffline(err, goToDashboard)) return;
      setError(
        isSupabaseUnreachable(err)
          ? SUPABASE_UNREACHABLE_MESSAGE
          : err instanceof Error
            ? err.message
            : 'An error occurred during signup.'
      );
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: { data: { name } },
      });

      if (error) {
        if (await enterDemoIfOffline(error, goToDashboard)) return;
        setError(isSupabaseUnreachable(error) ? SUPABASE_UNREACHABLE_MESSAGE : error.message);
        setLoading(false);
        return;
      }

      setOtpSent(true);
      setLoading(false);
    } catch (err: unknown) {
      if (await enterDemoIfOffline(err, goToDashboard)) return;
      setError(
        isSupabaseUnreachable(err)
          ? SUPABASE_UNREACHABLE_MESSAGE
          : err instanceof Error
            ? err.message
            : 'An error occurred while sending OTP.'
      );
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        if (await enterDemoIfOffline(error, goToDashboard)) return;
        setError(isSupabaseUnreachable(error) ? SUPABASE_UNREACHABLE_MESSAGE : error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await supabase.from('users').update({ phone: formattedPhone, name }).eq('id', data.user.id);
      }

      goToDashboard();
    } catch (err: unknown) {
      if (await enterDemoIfOffline(err, goToDashboard)) return;
      setError(
        isSupabaseUnreachable(err)
          ? SUPABASE_UNREACHABLE_MESSAGE
          : err instanceof Error
            ? err.message
            : 'An error occurred during verification.'
      );
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setLoading(true);
    setError('');
    try {
      const started = await startDemoSession();
      if (started) {
        goToDashboard();
        return;
      }
      setError(
        'Demo Mode is for local preview only. Sign in with your account (e.g. jesalp85@gmail.com) on production.'
      );
    } catch {
      setError(
        'Demo Mode is for local preview only. Sign in with your account (e.g. jesalp85@gmail.com) on production.'
      );
    }
    setLoading(false);
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
          <h2 className="text-2xl font-semibold mb-4">Start your 7-day free trial</h2>
          <p className="text-white/70 leading-relaxed">
            No credit card required. Generate AI-powered ad creatives and launch Meta campaigns in minutes.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-bold mb-2">Create your account</h2>
          <p className="text-muted mb-8">7-day free trial included</p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => { setMode('email'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'email' ? 'bg-primary text-white' : 'bg-gray-100 text-muted'
              }`}
            >
              <Mail className="w-4 h-4" /> Email
            </button>
            <button
              onClick={() => { setMode('phone'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'phone' ? 'bg-primary text-white' : 'bg-gray-100 text-muted'
              }`}
            >
              <Phone className="w-4 h-4" /> Phone OTP
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg mb-4">{error}</div>
          )}

          <div className="mb-4">
            <label className="label">Full Name</label>
            <input type="text" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {mode === 'email' ? (
            <form onSubmit={handleEmailSignup} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Creating account...' : 'Start Free Trial'}
              </button>
            </form>
          ) : !otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="label">Phone Number</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[var(--border)] bg-gray-50 text-sm">+91</span>
                  <input type="tel" className="input rounded-l-none" placeholder="9876543210" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label">Enter OTP</label>
                <input type="text" className="input" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} required maxLength={6} />
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
            </form>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted">Or local preview</span></div>
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg border border-primary text-primary font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
          >
            ⚡ Continue in Demo Mode
          </button>

          <p className="text-sm text-muted text-center mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
