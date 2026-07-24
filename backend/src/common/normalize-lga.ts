/**
 * LGA is free-text USSD input (no fixed picker — Kano alone has ~44), so two
 * people who both mean "Kano Municipal" could otherwise be stored as "kano
 * municipal" / "Kano  Municipal" / etc. and silently fail to match on the
 * eligibility check's exact-string comparison. `formatLga` canonicalizes at
 * write time (registration + agent coverage LGA) so DB-level exact-match
 * queries (digest, agent notifications) keep working unchanged; `normalizeLga`
 * is the extra defensive comparison for the in-memory eligibility check, in
 * case of any data written before this fix or edited outside the normal flow.
 */
export function formatLga(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

export function normalizeLga(raw: string): string {
  return formatLga(raw).toLowerCase();
}
