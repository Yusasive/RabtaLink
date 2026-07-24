import { Language } from '../database/entities/user.entity';

// UI-UX §4 gives this verbatim in Hausa with a [time] placeholder.
const copy = {
  ha: {
    precallPrompt: (time: string) =>
      `RabtaLink: Kiran ka na gabatarwa zai fara da karfe ${time}. Ka shirya wadannan tambayoyi guda 3: 1) Me kake so a rayuwa? 2) Yaya iyalinka suke? 3) Me kake bukata a aure?`,
  },
  en: {
    precallPrompt: (time: string) =>
      `RabtaLink: Your introduction call starts at ${time}. Prepare these 3 questions: 1) What do you want in life? 2) How is your family? 3) What do you need in marriage?`,
  },
} as const;

export function precallPromptSms(language: Language, time: string): string {
  return copy[language].precallPrompt(time);
}

// UI-UX §5's system-intro script, given verbatim — Hausa-only in the source doc,
// same treatment as M3's Voice OTP script (a spoken script, not casually translated).
const TAARUF_INTRO =
  "Barka da zuwa kiran gabatarwa na RabtaLink. Wannan kira zai dauki mintuna 15. Muna fatan za ku yi magana da mutunci da kunya. Ana fara kiran yanzu.";

// UI-UX §5: "a short additional line announces their presence on the line before
// the two principals are connected — transparency is non-negotiable here for trust."
// Exact wording isn't given in UI-UX; written here in the same register.
const GUARDIAN_PRESENCE_LINE = 'Wakilin iyali yana kan layi domin sa ido.';

export function taarufIntroText(guardianIncluded: boolean): string {
  return guardianIncluded ? `${TAARUF_INTRO} ${GUARDIAN_PRESENCE_LINE}` : TAARUF_INTRO;
}

const recordIntroCopy = {
  ha: {
    prompt: 'Bayan sauti, ka yi gajeren bayani game da kanka, sannan ka danna #.',
    thanks: 'Na gode! An ajiye bayaninka.',
  },
  en: {
    prompt: 'After the beep, give a short introduction about yourself, then press #.',
    thanks: 'Thank you! Your intro has been saved.',
  },
} as const;

export function recordIntroPromptText(language: Language): string {
  return recordIntroCopy[language].prompt;
}

export function recordIntroThanksText(language: Language): string {
  return recordIntroCopy[language].thanks;
}
