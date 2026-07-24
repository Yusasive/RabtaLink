'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, MatchRow } from '@/lib/api';
import { matchStatusBadge, StatusBadge } from '@/components/StatusBadge';

// UI-UX §6.2.3's 4 named columns, plus Declined so outcomes stay visible rather
// than silently disappearing — a small addition in service of agent transparency.
const COLUMNS: { title: string; statuses: string[] }[] = [
  { title: 'Proposed', statuses: ['proposed', 'accepted_a', 'accepted_b'] },
  { title: 'Both Accepted', statuses: ['both_accepted'] },
  { title: 'Call Scheduled', statuses: ['call_scheduled'] },
  { title: 'Completed', statuses: ['completed'] },
  { title: 'Declined', statuses: ['declined'] },
];

// A kanban board reads oddly if paginated — fetch the (server-capped) max page
// instead of the default 50, so it still feels "complete" at realistic scale
// without going back to an unbounded response.
const KANBAN_FETCH_LIMIT = 200;

export default function MatchTrackerPage() {
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMatches(KANBAN_FETCH_LIMIT)
      .then((res) => setMatches(res.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load matches.'));
  }, []);

  return (
    <div>
      <h1 className="text-lg font-semibold text-ink">Match tracker</h1>
      <p className="mt-1 text-sm text-ink-muted">Every match you've proposed, mirroring its live status.</p>

      {error && <p className="mt-6 text-sm text-danger">{error}</p>}
      {!error && matches === null && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-5">
          {COLUMNS.map((col) => (
            <div key={col.title} className="animate-pulse rounded-xl border border-border bg-paper-raised p-3">
              <div className="h-4 w-24 rounded bg-border" />
              <div className="mt-3 h-16 rounded-lg bg-border" />
            </div>
          ))}
        </div>
      )}

      {matches && (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = matches.filter((m) => col.statuses.includes(m.status));
            return (
              <div key={col.title} className="rounded-xl border border-border bg-paper-raised p-3">
                <h2 className="px-1 text-sm font-semibold text-ink-muted">
                  {col.title} <span className="font-normal">({items.length})</span>
                </h2>
                <div className="mt-2 grid gap-2">
                  {items.map((m) => {
                    const badge = matchStatusBadge(m.status);
                    return (
                      <div key={m.id} className="rounded-lg border border-border bg-paper p-3">
                        <p className="text-sm font-medium text-ink">
                          {m.userAName ?? '—'} + {m.userBName ?? '—'}
                        </p>
                        <div className="mt-2">
                          <StatusBadge kind={badge.kind} label={badge.label} />
                        </div>
                        {m.scheduledCallTime && (
                          <p className="mt-2 text-xs text-ink-muted">
                            Call: {new Date(m.scheduledCallTime).toLocaleString()}
                          </p>
                        )}
                        {m.callCompleted && <p className="mt-1 text-xs text-success">Call completed</p>}
                      </div>
                    );
                  })}
                  {items.length === 0 && <p className="px-1 py-2 text-xs text-ink-muted">None yet</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
