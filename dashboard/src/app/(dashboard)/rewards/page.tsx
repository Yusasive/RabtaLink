'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, RewardsResponse } from '@/lib/api';

export default function RewardsPage() {
  const [rewards, setRewards] = useState<RewardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getRewards()
      .then(setRewards)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load rewards.'));
  }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Reward ledger</h1>
      <p className="mt-1 text-sm text-ink-muted">Airtime rewards you've earned from successful matches.</p>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}

      {!error && rewards === null && (
        <div className="mt-6 animate-pulse space-y-4" aria-hidden="true">
          <div className="h-20 rounded-xl border border-border bg-paper-raised" />
          <div className="h-40 rounded-xl border border-border bg-paper-raised" />
        </div>
      )}

      {rewards && (
        <>
          <div className="mt-6 rounded-xl border border-border bg-accent-soft p-5">
            <p className="text-sm text-ink-muted">Total earned</p>
            <p className="mt-1 text-2xl font-semibold text-accent">₦{rewards.totalRewardsEarned}</p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-paper-raised">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-paper text-left text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">AT Reference</th>
                </tr>
              </thead>
              <tbody>
                {rewards.transactions.items.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-ink">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2 text-ink">₦{t.amount}</td>
                    <td className="px-4 py-2 text-ink-muted">{t.atTransactionId ?? '—'}</td>
                  </tr>
                ))}
                {rewards.transactions.items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-muted">
                      No rewards yet — successful matches will show up here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rewards.transactions.total > rewards.transactions.items.length && (
            <p className="mt-2 text-xs text-ink-muted">
              Showing {rewards.transactions.items.length} of {rewards.transactions.total}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
