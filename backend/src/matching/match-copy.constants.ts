import { Language } from '../database/entities/user.entity';

// UI-UX §4's Hausa "Match proposal" template reads "Balaga 1 don yarda, 2 don ki" —
// "Balaga" (lit. "reach puberty/maturity") doesn't fit this context and looks like a
// typo for "Danna"/"Bugi" (press/dial), the verb UI-UX itself uses for USSD shortcuts
// elsewhere (§6.2's "menu 2" framing). Corrected here; flagged for the product doc.
const copy = {
  ha: {
    proposal: 'RabtaLink: Wakilinmu ya samo maka wanda ya dace da kai. Danna 1 don yarda, 2 don ki.',
    bothAccepted:
      'RabtaLink: Bangarorin biyu sun yarda! Za a shirya muku kiran gabatarwa nan ba da jimawa ba.',
    declined: 'RabtaLink: Wannan shawarar ba ta ci gaba ba. Za mu ci gaba da neman wanda ya fi dacewa da kai.',
    digest: (count: number) =>
      `RabtaLink Digest: Muna da sabbin shawarwari ${count} gare ka wannan makon. Bude menu 2 don duba.`,
  },
  en: {
    proposal: 'RabtaLink: Our agent found someone who may suit you. Reply 1 to accept, 2 to decline.',
    bothAccepted: "RabtaLink: Both parties accepted! We'll schedule your introduction call soon.",
    declined: "RabtaLink: This match didn't go forward. We'll keep looking for a better fit for you.",
    digest: (count: number) =>
      `RabtaLink Digest: We have ${count} new suggestion${count === 1 ? '' : 's'} for you this week. Open menu 2 to view.`,
  },
} as const;

export function proposalSms(language: Language): string {
  return copy[language].proposal;
}

export function bothAcceptedSms(language: Language): string {
  return copy[language].bothAccepted;
}

export function declinedSms(language: Language): string {
  return copy[language].declined;
}

export function digestSms(language: Language, count: number): string {
  return copy[language].digest(count);
}
