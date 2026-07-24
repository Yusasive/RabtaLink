import { Language } from '../database/entities/user.entity';

export const COURTING_GESTURE_AMOUNT_NGN = 100;
// Not specified in PRD/TRD beyond "airtime credited... upon a successful match
// milestone" — a placeholder amount pending a real product/business decision,
// deliberately larger than the courting gesture since it rewards the agent's work.
export const AGENT_REWARD_AMOUNT_NGN = 500;

const copy = {
  ha: {
    giftReceived: (name: string) =>
      `RabtaLink: ${name} ya aiko maka N${COURTING_GESTURE_AMOUNT_NGN} na kyauta a matsayin alamar sha'awa. Duba menu 2 don amsawa.`,
  },
  en: {
    giftReceived: (name: string) =>
      `RabtaLink: ${name} sent you N${COURTING_GESTURE_AMOUNT_NGN} as a sign of interest. Check menu 2 to respond.`,
  },
} as const;

export function giftReceivedSms(language: Language, senderName: string): string {
  return copy[language].giftReceived(senderName);
}

// Agents table (TRD §3) has no language column — same Hausa-only decision as M3's
// agent-facing copy.
export function agentRewardSms(): string {
  return `RabtaLink: An samu lada N${AGENT_REWARD_AMOUNT_NGN} saboda cin nasarar zumunci. Na gode da aikinku!`;
}
