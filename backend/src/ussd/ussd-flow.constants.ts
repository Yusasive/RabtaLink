import { IntentType, Language } from '../database/entities/user.entity';
import { COURTING_GESTURE_AMOUNT_NGN } from '../ledger/ledger-copy.constants';

// TRD §3 age_bracket values, in USSD menu order.
export const AGE_BRACKETS = ['18-24', '25-30', '31-35', '36+'] as const;

export const INTENT_BY_CHOICE: Record<string, IntentType> = {
  '1': 'marriage',
  '2': 'friendship',
  '3': 'professional',
};

export const INTEREST_TAG_BY_CHOICE: Record<string, string> = {
  '1': 'religion',
  '2': 'business',
  '3': 'sports',
  '4': 'education',
  '5': 'arts_craft',
  '6': 'cooking',
};

export const MAX_INTEREST_TAGS = 3;

// UI-UX §1.5: Hausa offered first at every entry point. Screen 1 is the one
// screen shown before a language is known, so it is always bilingual.
export const WELCOME_SCREEN = `Barka da zuwa RabtaLink
1. Hausa
2. English`;

const copy = {
  ha: {
    mainMenu: `RabtaLink
1. Yi Rijista
2. Ma'auratana Na
3. Yi Gajeren Bayani
4. Zama Wakili
5. Taimako`,
    menuStub: 'Wannan sabis din ba a samu ba tukuna. Na gode!',
    resumePrompt: `An samu rijista da ka
fara. Ka ci gaba?
1. Ee
2. A'a, sabon rijista`,
    registerName: 'Shigar da sunanka:',
    registerAge: `Zabi shekarunka:
1. 18-24
2. 25-30
3. 31-35
4. 36+`,
    registerLga: 'Shigar da Karamar Hukumarka (LGA):',
    registerIntent: `Me kake nema?
1. Aure (Marriage)
2. Aboki/Abokiya (Friendship)
3. Hulda ta Sana'a (Professional)`,
    registerInterests: `Zabi sha'awarka (har 3):
1.Addini 2.Kasuwanci
3.Wasanni 4.Karatu
5.Fasaha 6.Girki
Misali: 1,3,5`,
    registerGuardianPhone: `Don Allah shigar da
lambar wayar wanda
zai amince maka
(uba/mahaifiya/wali)`,
    confirmationMarriage: `Na gode! An samu
bayaninka. Za mu
tuntubi wakilinka
don amincewa.`,
    confirmationOther: `Na gode! An samu
bayaninka. Za ka fara
samun shawarwari
daga wakilinmu.`,
    agentName: 'Shigar da sunanka:',
    agentLga: 'Shigar da yankin da za ka rufe (LGA):',
    agentCallPending: `Na gode! Za a kira ka
nan take domin tabbatarwa.
Duba SMS domin lambar
shaida.`,
    agentAlreadyVerified: 'An riga an tabbatar da kai a matsayin Wakili.',
    agentMenu: `Menu Wakili:
1. Bada Shawarar Zumunci
2. Koma Baya`,
    agentProposePhoneA: 'Shigar da lambar wayar mutum na farko:',
    agentProposePhoneB: 'Shigar da lambar wayar mutum na biyu:',
    proposeUserNotFound: 'Ba a samu wannan lambar ba a cikin RabtaLink. Duba lambobin.',
    proposeIneligible: "Wadannan mutane biyu ba za a iya hada su ba (bincika LGA, bukata, ko matsayin amincewa).",
    proposeCancelled: 'An soke shawarar.',
    proposeSent: `An aika shawarar zumunci.
Za a sanar da bangarorin
biyu ta SMS.`,
    myMatchesNone: 'Ba ka da wata alaka mai aiki a yanzu.',
    myMatchesConfirm: `An same maka wanda kuka
dace. Aika N${COURTING_GESTURE_AMOUNT_NGN} a matsayin
kyautar sha'awa?
1. Ee 2. A'a`,
    giftSent: `An aika N${COURTING_GESTURE_AMOUNT_NGN} a matsayin
kyautar sha'awa!`,
    recordIntroPending: `Za a kira ka nan take
domin yin gajeren bayani.
Ka amsa kiran.`,
    invalidChoice: 'Zabin da ba daidai ba.',
  },
  en: {
    mainMenu: `RabtaLink
1. Register
2. My Matches
3. Record Voice Intro
4. Become an Agent
5. Help`,
    menuStub: "This service isn't available yet. Thank you!",
    resumePrompt: `We found a registration
you started. Continue?
1. Yes
2. No, start over`,
    registerName: 'Enter your name:',
    registerAge: `Select your age:
1. 18-24
2. 25-30
3. 31-35
4. 36+`,
    registerLga: 'Enter your LGA (location):',
    registerIntent: `What are you looking for?
1. Marriage
2. Friendship
3. Professional Circle`,
    registerInterests: `Pick up to 3 interests:
1.Religion 2.Business
3.Sports 4.Education
5.Arts/Craft 6.Cooking
e.g: 1,3,5`,
    registerGuardianPhone: `Please enter the phone
number of your guardian
who will give consent
(father/mother/wali)`,
    confirmationMarriage: `Thank you! Your details
are saved. We'll contact
your guardian for consent.`,
    confirmationOther: `Thank you! Your details
are saved. You'll start
getting introductions
from our agents soon.`,
    agentName: 'Enter your name:',
    agentLga: "Enter the LGA you'll cover:",
    agentCallPending: `Thank you! You'll be
called shortly to verify.
Check your SMS for
the code.`,
    agentAlreadyVerified: "You're already a verified Agent.",
    agentMenu: `Agent Menu:
1. Propose a Match
2. Back`,
    agentProposePhoneA: 'Enter the phone number of the first person:',
    agentProposePhoneB: 'Enter the phone number of the second person:',
    proposeUserNotFound: "That number isn't registered on RabtaLink. Check the numbers.",
    proposeIneligible: "These two can't be matched (check LGA, intent, or consent status).",
    proposeCancelled: 'Proposal cancelled.',
    proposeSent: `Match proposal sent.
Both parties will be
notified by SMS.`,
    myMatchesNone: "You don't have an active match right now.",
    myMatchesConfirm: `We found your match.
Send them N${COURTING_GESTURE_AMOUNT_NGN} as a
gesture of interest?
1. Yes 2. No`,
    giftSent: `Sent N${COURTING_GESTURE_AMOUNT_NGN} as a
gesture of interest!`,
    recordIntroPending: `You'll be called shortly
to record your intro.
Please answer the call.`,
    invalidChoice: 'Invalid choice.',
  },
} as const;

export type CopyKey = keyof (typeof copy)['ha'];

export function screenText(language: Language, key: CopyKey): string {
  return copy[language][key];
}

export function withInvalidPrefix(language: Language, screen: string): string {
  return `${copy[language].invalidChoice}\n${screen}`;
}

export function smsConfirmation(language: Language, name: string, intentType: IntentType): string {
  const key = intentType === 'marriage' ? 'confirmationMarriage' : 'confirmationOther';
  return `RabtaLink: ${name}! ${copy[language][key]}`;
}

export function proposeConfirmScreen(language: Language, summary: string): string {
  const confirmLine = language === 'ha' ? 'Tabbatar? 1. Ee 2. A\'a' : 'Confirm? 1. Yes 2. No';
  return `${summary}\n${confirmLine}`;
}
