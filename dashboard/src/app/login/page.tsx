'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.requestOtp(phoneNumber.trim());
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { accessToken } = await api.verifyOtp(phoneNumber.trim(), code.trim());
      setToken(accessToken);
      router.replace('/registrants');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adire-pattern flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-paper-raised p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-ink">RabtaLink</h1>
        <p className="mt-1 text-sm text-ink-muted">Rabta Agent dashboard sign-in</p>

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-ink">
                Your verified Agent phone number
              </label>
              <input
                id="phone"
                type="tel"
                required
                placeholder="+2348012345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {loading ? 'Sending code…' : 'Send login code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            <p className="text-sm text-ink-muted">
              We sent a code by SMS to <span className="font-medium text-ink">{phoneNumber}</span>.
            </p>
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-ink">
                Enter the code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
              />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
            >
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button
              type="button"
              onClick={() => setStep('phone')}
              className="w-full text-center text-sm text-ink-muted hover:text-ink"
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
