'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, EligibilityResult, Registrant } from '@/lib/api';

export default function ProposeMatchPage() {
  const router = useRouter();
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [phoneA, setPhoneA] = useState('');
  const [phoneB, setPhoneB] = useState('');
  const [evaluation, setEvaluation] = useState<EligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getRegistrants(200)
      .then((res) => setRegistrants(res.items))
      .catch(() => setRegistrants([]));
  }, []);

  async function handleEvaluate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEvaluation(null);
    setBusy(true);
    try {
      setEvaluation(await api.evaluateMatch(phoneA, phoneB));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await api.proposeMatch(phoneA, phoneB);
      router.push('/matches');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Propose a match</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Pick two registrants you already know are a good fit — RabtaLink checks eligibility, the judgment is yours.
      </p>

      <form onSubmit={handleEvaluate} className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <RegistrantPicker label="Person A" value={phoneA} onChange={setPhoneA} registrants={registrants} />
        <RegistrantPicker label="Person B" value={phoneB} onChange={setPhoneB} registrants={registrants} />

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={!phoneA || !phoneB || busy}
            className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Checking…' : 'Check compatibility'}
          </button>
        </div>
      </form>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}

      {evaluation && !evaluation.ok && (
        <p className="mt-6 rounded-lg border border-border bg-danger-soft p-4 text-sm text-danger">
          {evaluation.reason === 'not_found'
            ? "One or both numbers aren't registered."
            : "These two can't be matched right now (check LGA, intent, or consent status)."}
        </p>
      )}

      {evaluation?.ok && (
        <div className="mt-6 rounded-xl border border-border bg-paper-raised p-5">
          <h2 className="font-medium text-ink">
            {evaluation.userA.name ?? 'Person A'} + {evaluation.userB.name ?? 'Person B'}
          </h2>
          {/* Compatibility summary line only — never a raw algorithmic score (UI-UX §6.2.2, Principle 3). */}
          <p className="mt-1 text-sm text-ink-muted">{evaluation.summary}</p>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="mt-4 rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition hover:bg-accent-hover disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Confirm proposal'}
          </button>
        </div>
      )}
    </div>
  );
}

function RegistrantPicker({
  label,
  value,
  onChange,
  registrants,
}: {
  label: string;
  value: string;
  onChange: (phone: string) => void;
  registrants: Registrant[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-border bg-paper px-3 py-2 text-ink outline-none focus:border-accent"
      >
        <option value="">Select a registrant…</option>
        {registrants.map((r) => (
          <option key={r.id} value={r.phoneNumber}>
            {r.name ?? r.phoneNumber} — {r.lga} ({r.intentType})
          </option>
        ))}
      </select>
    </div>
  );
}
