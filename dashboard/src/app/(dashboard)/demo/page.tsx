'use client';

import { useEffect, useRef, useState } from 'react';
import { ActivityChannel, ActivityEvent, api, ApiError } from '@/lib/api';

const POLL_MS = 1500;

const CHANNEL_META: Record<ActivityChannel, { label: string; bg: string; text: string; icon: string }> = {
  ussd: { label: 'USSD', bg: 'bg-accent-soft', text: 'text-accent', icon: '☎' },
  sms: { label: 'SMS', bg: 'bg-warn-soft', text: 'text-warn', icon: '✉' },
  voice: { label: 'Voice', bg: 'bg-terracotta-soft', text: 'text-terracotta', icon: '📞' },
  airtime: { label: 'Airtime', bg: 'bg-success-soft', text: 'text-success', icon: '₦' },
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export default function DemoScreenPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [counts, setCounts] = useState<Record<ActivityChannel, number>>({ ussd: 0, sms: 0, voice: 0, airtime: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, forceTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await api.getActivity(60);
        if (!cancelled) {
          setEvents(res.events);
          setCounts(res.counts);
          setError(null);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to reach the API.');
          setLoaded(true);
        }
      }
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_MS);
    // Re-render every second just to keep "Xs ago" labels fresh, independent of polling.
    const tickInterval = setInterval(() => forceTick((t) => t + 1), 1000);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(tickInterval);
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">Live activity</h1>
      <p className="mt-1 text-base text-ink-muted">
        Every USSD, SMS, Voice, and Airtime event firing against the sandbox, in real time.
      </p>

      {error && <p className="mt-4 text-base text-danger">{error}</p>}

      {!loaded ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-paper-raised" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(Object.keys(CHANNEL_META) as ActivityChannel[]).map((channel) => {
            const meta = CHANNEL_META[channel];
            return (
              <div key={channel} className={`rounded-2xl border border-border p-5 ${meta.bg}`}>
                <p className={`text-sm font-medium ${meta.text}`}>
                  <span aria-hidden="true">{meta.icon}</span> {meta.label}
                </p>
                <p className={`mt-1 text-4xl font-bold ${meta.text}`}>{counts[channel]}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid gap-3">
        {loaded && events.length === 0 && !error && (
          <p className="text-lg text-ink-muted">No activity yet — trigger something via USSD, SMS, Voice, or Airtime.</p>
        )}
        {events.map((event) => {
          const meta = CHANNEL_META[event.channel];
          return (
            <div
              key={event.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-paper-raised px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <span
                className={`inline-flex w-fit shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-base font-semibold ${meta.bg} ${meta.text}`}
              >
                <span aria-hidden="true">{meta.icon}</span>
                {meta.label}
                <span aria-hidden="true">{event.direction === 'inbound' ? '←' : '→'}</span>
              </span>
              <p className="flex-1 text-lg text-ink">{event.summary}</p>
              <span className="shrink-0 text-base text-ink-muted">{timeAgo(event.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
