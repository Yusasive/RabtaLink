import { nextMatchStatus, parseMatchDecision } from './match-status';

describe('parseMatchDecision', () => {
  it('parses "1" as accept', () => {
    expect(parseMatchDecision('1')).toBe('accept');
  });

  it('parses "2" as decline', () => {
    expect(parseMatchDecision('2')).toBe('decline');
  });

  it('trims surrounding whitespace', () => {
    expect(parseMatchDecision('  1  ')).toBe('accept');
    expect(parseMatchDecision('\t2\n')).toBe('decline');
  });

  it.each(['', '3', 'yes', '1a', 'a1', '11', '0'])('returns null for non-decision input %p', (input) => {
    expect(parseMatchDecision(input)).toBeNull();
  });
});

describe('nextMatchStatus', () => {
  describe('decline', () => {
    it.each(['proposed', 'accepted_a', 'accepted_b', 'both_accepted', 'call_scheduled', 'completed'] as const)(
      'moves %s -> declined regardless of which side declines',
      (current) => {
        expect(nextMatchStatus(current, true, 'decline')).toBe('declined');
        expect(nextMatchStatus(current, false, 'decline')).toBe('declined');
      },
    );

    it('is a no-op if already declined', () => {
      expect(nextMatchStatus('declined', true, 'decline')).toBeNull();
      expect(nextMatchStatus('declined', false, 'decline')).toBeNull();
    });
  });

  describe('accept, first response', () => {
    it('userA accepting a freshly proposed match -> accepted_a', () => {
      expect(nextMatchStatus('proposed', true, 'accept')).toBe('accepted_a');
    });

    it('userB accepting a freshly proposed match -> accepted_b', () => {
      expect(nextMatchStatus('proposed', false, 'accept')).toBe('accepted_b');
    });
  });

  describe('accept, second response completes both_accepted', () => {
    it('userB accepting after userA already did -> both_accepted', () => {
      expect(nextMatchStatus('accepted_a', false, 'accept')).toBe('both_accepted');
    });

    it('userA accepting after userB already did -> both_accepted', () => {
      expect(nextMatchStatus('accepted_b', true, 'accept')).toBe('both_accepted');
    });
  });

  describe('accept, same side replying again is a no-op (no double-accept)', () => {
    it('userA accepting again while already accepted_a', () => {
      expect(nextMatchStatus('accepted_a', true, 'accept')).toBeNull();
    });

    it('userB accepting again while already accepted_b', () => {
      expect(nextMatchStatus('accepted_b', false, 'accept')).toBeNull();
    });
  });

  describe('accept on a match that has nothing left to do', () => {
    it.each(['both_accepted', 'call_scheduled', 'completed'] as const)(
      'accept on %s -> null (already resolved)',
      (current) => {
        expect(nextMatchStatus(current, true, 'accept')).toBeNull();
        expect(nextMatchStatus(current, false, 'accept')).toBeNull();
      },
    );
  });
});
