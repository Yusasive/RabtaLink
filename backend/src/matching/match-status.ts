import { MatchStatus } from '../database/entities/match.entity';

export type MatchDecision = 'accept' | 'decline';

/**
 * Pure state-transition logic for the SMS "1"/"2" accept/decline reply (M4).
 * Extracted out of MatchingService (which just orchestrates DB/SMS around it)
 * specifically so it's trivially unit-testable with no mocking required.
 */
export function nextMatchStatus(current: MatchStatus, isUserA: boolean, decision: MatchDecision): MatchStatus | null {
  if (decision === 'decline') {
    return current === 'declined' ? null : 'declined';
  }
  if (current === 'proposed') return isUserA ? 'accepted_a' : 'accepted_b';
  if (current === 'accepted_a') return isUserA ? null : 'both_accepted';
  if (current === 'accepted_b') return isUserA ? 'both_accepted' : null;
  return null;
}

export function parseMatchDecision(rawText: string): MatchDecision | null {
  const text = rawText.trim();
  if (/^1$/.test(text)) return 'accept';
  if (/^2$/.test(text)) return 'decline';
  return null;
}
