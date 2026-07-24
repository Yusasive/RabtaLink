import { IntentType, Language } from '../database/entities/user.entity';

export enum UssdStep {
  LANGUAGE = 'language',
  MAIN_MENU = 'main_menu',
  RESUME_PROMPT = 'resume_prompt',
  REGISTER_NAME = 'register_name',
  REGISTER_AGE = 'register_age',
  REGISTER_LGA = 'register_lga',
  REGISTER_INTENT = 'register_intent',
  REGISTER_INTERESTS = 'register_interests',
  REGISTER_GUARDIAN_PHONE = 'register_guardian_phone',
  AGENT_NAME = 'agent_name',
  AGENT_LGA = 'agent_lga',
  AGENT_MENU = 'agent_menu',
  AGENT_PROPOSE_PHONE_A = 'agent_propose_phone_a',
  AGENT_PROPOSE_PHONE_B = 'agent_propose_phone_b',
  AGENT_PROPOSE_CONFIRM = 'agent_propose_confirm',
  MY_MATCHES_CONFIRM = 'my_matches_confirm',
}

export interface PendingProposal {
  userAId: string;
  userBId: string;
  summary: string;
}

export interface GiftContext {
  matchId: string;
  partnerId: string;
}

export interface CollectedData {
  language?: Language;
  name?: string;
  ageBracket?: string;
  lga?: string;
  intentType?: IntentType;
  interestTags?: string[];
  guardianPhone?: string;
  proposePhoneA?: string;
  proposal?: PendingProposal;
  giftContext?: GiftContext;
}

export interface UssdSessionRecord {
  step: UssdStep;
  collected: CollectedData;
  // Only set while step === RESUME_PROMPT: the step to jump back to on "yes".
  resumeTarget?: UssdStep;
}
