import { formatLga, normalizeLga } from './normalize-lga';

describe('formatLga', () => {
  it('trims and title-cases', () => {
    expect(formatLga('  kano municipal  ')).toBe('Kano Municipal');
  });

  it('collapses internal whitespace', () => {
    expect(formatLga('Kano    Municipal')).toBe('Kano Municipal');
  });

  it('is idempotent', () => {
    const once = formatLga('kano municipal');
    expect(formatLga(once)).toBe(once);
  });
});

describe('normalizeLga', () => {
  it('treats case/whitespace variants as the same LGA — the actual matching bug this fixes', () => {
    const variants = ['Kano Municipal', 'kano municipal', '  KANO   MUNICIPAL ', 'Kano municipal'];
    const normalized = variants.map(normalizeLga);
    expect(new Set(normalized).size).toBe(1);
  });

  it('still treats genuinely different LGAs as different', () => {
    expect(normalizeLga('Kano Municipal')).not.toBe(normalizeLga('Dala'));
  });
});
