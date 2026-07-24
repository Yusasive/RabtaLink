'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, Registrant } from '@/lib/api';
import { consentBadge, StatusBadge } from '@/components/StatusBadge';
import { SkeletonList } from '@/components/Skeleton';

const INTENT_LABEL: Record<string, string> = {
  marriage: 'Marriage',
  friendship: 'Friendship',
  professional: 'Professional Circle',
};

export default function RegistrantsPage() {
  const [registrants, setRegistrants] = useState<Registrant[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRegistrants()
      .then((res) => {
        setRegistrants(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load registrants.'));
  }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Your registrants</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Everyone registered in your coverage LGA, sorted so anyone needing action comes first.
        {total > 0 && ` Showing ${registrants?.length ?? 0} of ${total}.`}
      </p>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}
      {!error && registrants === null && <SkeletonList />}
      {registrants?.length === 0 && (
        <p className="mt-6 text-sm text-ink-muted">No registrants in your LGA yet.</p>
      )}

      <div className="mt-6 grid gap-3">
        {registrants?.map((r) => {
          const badge = consentBadge(r.consentStatus);
          return (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-xl border border-border bg-paper-raised p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink">{r.name ?? 'Unnamed'}</span>
                  {r.needsAction && <StatusBadge kind="pending" label="Needs action" />}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {r.phoneNumber} · {INTENT_LABEL[r.intentType] ?? r.intentType} · {r.lga ?? 'No LGA'} ·{' '}
                  {r.ageBracket ?? '—'}
                </p>
              </div>
              <StatusBadge kind={badge.kind} label={badge.label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
