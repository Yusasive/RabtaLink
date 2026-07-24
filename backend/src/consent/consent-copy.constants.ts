import { Language } from '../database/entities/user.entity';

// UI-UX §4 gives the Hausa consent-request and approval templates verbatim; English
// versions and the decline/reminder templates aren't spelled out there so are written
// here in the same terse, respectful tone (UI-UX §7 — no urgency/FOMO language).
const copy = {
  ha: {
    consentRequest: (name: string) =>
      `RabtaLink: ${name} ya bukaci neman aboki/abokiya ta hanyar RabtaLink. Ka amince? Ka aika YES ko NO.`,
    consentReminder: (name: string) =>
      `RabtaLink: Muna jira amincewarka ga ${name}. Ka aika YES ko NO.`,
    registrantApproved: 'RabtaLink: An amince! An kunna bayaninka. Za ka fara samun shawarwari daga wakilinmu.',
    registrantDeclined:
      'RabtaLink: An ki amincewa. Bayaninka na nan a tsaye. Tuntubi Taimako idan kana bukatar taimako.',
  },
  en: {
    consentRequest: (name: string) =>
      `RabtaLink: ${name} wants to find a partner through RabtaLink. Do you consent? Reply YES or NO.`,
    consentReminder: (name: string) =>
      `RabtaLink: Still waiting on your consent for ${name}. Reply YES or NO.`,
    registrantApproved: "RabtaLink: Approved! Your profile is now active. You'll start getting introductions from our agents.",
    registrantDeclined:
      'RabtaLink: Consent was declined. Your profile remains on hold. Contact Help if you need assistance.',
  },
} as const;

export function consentRequestSms(language: Language, registrantName: string): string {
  return copy[language].consentRequest(registrantName);
}

export function consentReminderSms(language: Language, registrantName: string): string {
  return copy[language].consentReminder(registrantName);
}

export function registrantApprovedSms(language: Language): string {
  return copy[language].registrantApproved;
}

export function registrantDeclinedSms(language: Language): string {
  return copy[language].registrantDeclined;
}
