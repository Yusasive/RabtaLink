import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ActivityLogService } from '../activity/activity-log.service';
import { AgentsService } from '../agents/agents.service';
import { ConsentService } from '../consent/consent.service';
import { formatLga } from '../common/normalize-lga';
import { Guardian } from '../database/entities/guardian.entity';
import { IntentType, Language, User } from '../database/entities/user.entity';
import { AirtimeService } from '../ledger/airtime.service';
import { MatchingService } from '../matching/matching.service';
import { SmsService } from '../notifications/sms.service';
import { VoiceService } from '../notifications/voice.service';
import {
  AGE_BRACKETS,
  INTENT_BY_CHOICE,
  INTEREST_TAG_BY_CHOICE,
  MAX_INTEREST_TAGS,
  WELCOME_SCREEN,
  proposeConfirmScreen,
  screenText,
  smsConfirmation,
  withInvalidPrefix,
} from './ussd-flow.constants';
import { CollectedData, UssdSessionRecord, UssdStep } from './ussd-flow.types';
import { UssdSessionStore } from './ussd-session.store';

export interface UssdRequest {
  sessionId: string;
  phoneNumber: string;
  text: string;
}

interface StepResult {
  response: string; // full "CON ..." or "END ..." string
  session: UssdSessionRecord | null; // null once the session is over (done or stubbed out)
}

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);

  constructor(
    private readonly sessions: UssdSessionStore,
    private readonly smsService: SmsService,
    private readonly consentService: ConsentService,
    private readonly agentsService: AgentsService,
    private readonly matchingService: MatchingService,
    private readonly airtimeService: AirtimeService,
    private readonly voiceService: VoiceService,
    private readonly activityLog: ActivityLogService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async handle(request: UssdRequest): Promise<string> {
    const { sessionId, phoneNumber } = request;
    const newInput = this.lastInputSegment(request.text);

    const session = await this.sessions.getSession(sessionId);
    let result: StepResult;

    if (!session) {
      result = await this.startSession(phoneNumber);
    } else {
      result = await this.advance(session, newInput, phoneNumber);
    }

    if (result.session) {
      await this.sessions.saveSession(sessionId, result.session);
      if (result.session.collected.language) {
        await this.sessions.saveResume(phoneNumber, result.session);
      }
    } else {
      await this.sessions.clearSession(sessionId);
      await this.sessions.clearResume(phoneNumber);
    }

    this.activityLog.record({
      channel: 'ussd',
      direction: 'inbound',
      summary: `USSD ${phoneNumber} entered "${newInput || '(dial-in)'}" → ${result.response.slice(0, 60)}${result.response.length > 60 ? '…' : ''}`,
      phoneNumber,
    });

    return result.response;
  }

  private lastInputSegment(text: string): string {
    if (!text) return '';
    const parts = text.split('*');
    return (parts[parts.length - 1] ?? '').trim();
  }

  private async startSession(phoneNumber: string): Promise<StepResult> {
    const resume = await this.sessions.getResume(phoneNumber);
    if (resume && resume.collected.language) {
      const session: UssdSessionRecord = {
        step: UssdStep.RESUME_PROMPT,
        collected: resume.collected,
        resumeTarget: resume.step,
      };
      return { response: `CON ${screenText(resume.collected.language, 'resumePrompt')}`, session };
    }

    const session: UssdSessionRecord = { step: UssdStep.LANGUAGE, collected: {} };
    return { response: `CON ${WELCOME_SCREEN}`, session };
  }

  private async advance(
    session: UssdSessionRecord,
    input: string,
    phoneNumber: string,
  ): Promise<StepResult> {
    switch (session.step) {
      case UssdStep.LANGUAGE:
        return this.handleLanguage(session, input);
      case UssdStep.RESUME_PROMPT:
        return this.handleResumePrompt(session, input);
      case UssdStep.MAIN_MENU:
        return this.handleMainMenu(session, input, phoneNumber);
      case UssdStep.REGISTER_NAME:
        return this.handleName(session, input);
      case UssdStep.REGISTER_AGE:
        return this.handleAge(session, input);
      case UssdStep.REGISTER_LGA:
        return this.handleLga(session, input);
      case UssdStep.REGISTER_INTENT:
        return this.handleIntent(session, input);
      case UssdStep.REGISTER_INTERESTS:
        return this.handleInterests(session, input, phoneNumber);
      case UssdStep.REGISTER_GUARDIAN_PHONE:
        return this.handleGuardianPhone(session, input, phoneNumber);
      case UssdStep.AGENT_NAME:
        return this.handleAgentName(session, input);
      case UssdStep.AGENT_LGA:
        return this.handleAgentLga(session, input, phoneNumber);
      case UssdStep.AGENT_MENU:
        return this.handleAgentMenu(session, input);
      case UssdStep.AGENT_PROPOSE_PHONE_A:
        return this.handleAgentProposePhoneA(session, input);
      case UssdStep.AGENT_PROPOSE_PHONE_B:
        return this.handleAgentProposePhoneB(session, input);
      case UssdStep.AGENT_PROPOSE_CONFIRM:
        return this.handleAgentProposeConfirm(session, input, phoneNumber);
      case UssdStep.MY_MATCHES_CONFIRM:
        return this.handleMyMatchesConfirm(session, input, phoneNumber);
    }
  }

  private handleLanguage(session: UssdSessionRecord, input: string): StepResult {
    const language: Language | null = input === '1' ? 'ha' : input === '2' ? 'en' : null;
    if (!language) {
      return { response: `CON Invalid choice / Zabi mara kyau.\n${WELCOME_SCREEN}`, session };
    }
    const collected: CollectedData = { ...session.collected, language };
    const next: UssdSessionRecord = { step: UssdStep.MAIN_MENU, collected };
    return { response: `CON ${screenText(language, 'mainMenu')}`, session: next };
  }

  private handleResumePrompt(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    if (input === '1' && session.resumeTarget) {
      const next: UssdSessionRecord = { step: session.resumeTarget, collected: session.collected };
      return { response: `CON ${this.promptFor(next)}`, session: next };
    }
    if (input === '2') {
      const next: UssdSessionRecord = { step: UssdStep.LANGUAGE, collected: {} };
      return { response: `CON ${WELCOME_SCREEN}`, session: next };
    }
    return { response: `CON ${withInvalidPrefix(language, screenText(language, 'resumePrompt'))}`, session };
  }

  private async handleMainMenu(
    session: UssdSessionRecord,
    input: string,
    phoneNumber: string,
  ): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    if (input === '1') {
      const next: UssdSessionRecord = { step: UssdStep.REGISTER_NAME, collected: session.collected };
      return { response: `CON ${screenText(language, 'registerName')}`, session: next };
    }
    if (input === '2') {
      const found = await this.matchingService.findActiveMatchForUser(phoneNumber);
      if (!found) {
        return { response: `END ${screenText(language, 'myMatchesNone')}`, session: null };
      }
      const collected: CollectedData = {
        ...session.collected,
        giftContext: { matchId: found.match.id, partnerId: found.partner.id },
      };
      const next: UssdSessionRecord = { step: UssdStep.MY_MATCHES_CONFIRM, collected };
      return { response: `CON ${screenText(language, 'myMatchesConfirm')}`, session: next };
    }
    if (input === '4') {
      const agent = await this.agentsService.findByPhone(phoneNumber);
      if (agent?.verified) {
        const next: UssdSessionRecord = { step: UssdStep.AGENT_MENU, collected: session.collected };
        return { response: `CON ${screenText(language, 'agentMenu')}`, session: next };
      }
      const next: UssdSessionRecord = { step: UssdStep.AGENT_NAME, collected: session.collected };
      return { response: `CON ${screenText(language, 'agentName')}`, session: next };
    }
    if (input === '3') {
      await this.voiceService.markRecordIntroPending(phoneNumber, language);
      this.voiceService
        .placeCall(phoneNumber)
        .catch((err: unknown) => this.logger.error(`Record-intro call failed for ${phoneNumber}`, err));
      return { response: `END ${screenText(language, 'recordIntroPending')}`, session: null };
    }
    if (input === '5') {
      return { response: `END ${screenText(language, 'menuStub')}`, session: null };
    }
    return { response: `CON ${withInvalidPrefix(language, screenText(language, 'mainMenu'))}`, session };
  }

  private handleName(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    if (!input) {
      return { response: `CON ${withInvalidPrefix(language, screenText(language, 'registerName'))}`, session };
    }
    const collected: CollectedData = { ...session.collected, name: input };
    const next: UssdSessionRecord = { step: UssdStep.REGISTER_AGE, collected };
    return { response: `CON ${screenText(language, 'registerAge')}`, session: next };
  }

  private handleAge(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    const index = Number(input) - 1;
    const ageBracket = AGE_BRACKETS[index];
    if (!ageBracket) {
      return { response: `CON ${withInvalidPrefix(language, screenText(language, 'registerAge'))}`, session };
    }
    const collected: CollectedData = { ...session.collected, ageBracket };
    const next: UssdSessionRecord = { step: UssdStep.REGISTER_LGA, collected };
    return { response: `CON ${screenText(language, 'registerLga')}`, session: next };
  }

  private handleLga(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    if (input.length < 2) {
      return { response: `CON ${withInvalidPrefix(language, screenText(language, 'registerLga'))}`, session };
    }
    const collected: CollectedData = { ...session.collected, lga: formatLga(input) };
    const next: UssdSessionRecord = { step: UssdStep.REGISTER_INTENT, collected };
    return { response: `CON ${screenText(language, 'registerIntent')}`, session: next };
  }

  private handleIntent(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    const intentType = INTENT_BY_CHOICE[input];
    if (!intentType) {
      return { response: `CON ${withInvalidPrefix(language, screenText(language, 'registerIntent'))}`, session };
    }
    const collected: CollectedData = { ...session.collected, intentType };
    const next: UssdSessionRecord = { step: UssdStep.REGISTER_INTERESTS, collected };
    return { response: `CON ${screenText(language, 'registerInterests')}`, session: next };
  }

  private async handleInterests(
    session: UssdSessionRecord,
    input: string,
    phoneNumber: string,
  ): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    const tags = [
      ...new Set(
        input
          .split(',')
          .map((choice) => choice.trim())
          .map((choice) => INTEREST_TAG_BY_CHOICE[choice])
          .filter((tag): tag is string => Boolean(tag)),
      ),
    ].slice(0, MAX_INTEREST_TAGS);

    if (tags.length === 0) {
      return {
        response: `CON ${withInvalidPrefix(language, screenText(language, 'registerInterests'))}`,
        session,
      };
    }

    const collected: CollectedData = { ...session.collected, interestTags: tags };

    if (collected.intentType === 'marriage') {
      const next: UssdSessionRecord = { step: UssdStep.REGISTER_GUARDIAN_PHONE, collected };
      return { response: `CON ${screenText(language, 'registerGuardianPhone')}`, session: next };
    }

    const response = await this.finalizeRegistration(phoneNumber, collected);
    return { response, session: null };
  }

  private async handleGuardianPhone(
    session: UssdSessionRecord,
    input: string,
    phoneNumber: string,
  ): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    if (!/^(\+?\d{10,15})$/.test(input)) {
      return {
        response: `CON ${withInvalidPrefix(language, screenText(language, 'registerGuardianPhone'))}`,
        session,
      };
    }
    const collected: CollectedData = { ...session.collected, guardianPhone: input };
    const response = await this.finalizeRegistration(phoneNumber, collected);
    return { response, session: null };
  }

  private handleAgentName(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    if (!input) {
      return { response: `CON ${withInvalidPrefix(language, screenText(language, 'agentName'))}`, session };
    }
    const collected: CollectedData = { ...session.collected, name: input };
    const next: UssdSessionRecord = { step: UssdStep.AGENT_LGA, collected };
    return { response: `CON ${screenText(language, 'agentLga')}`, session: next };
  }

  private async handleAgentLga(
    session: UssdSessionRecord,
    input: string,
    phoneNumber: string,
  ): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    if (input.length < 2) {
      return { response: `CON ${withInvalidPrefix(language, screenText(language, 'agentLga'))}`, session };
    }
    const response = await this.finalizeAgentRegistration(
      phoneNumber,
      session.collected.name ?? '',
      formatLga(input),
      language,
    );
    return { response, session: null };
  }

  private handleAgentMenu(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    if (input === '1') {
      const next: UssdSessionRecord = { step: UssdStep.AGENT_PROPOSE_PHONE_A, collected: session.collected };
      return { response: `CON ${screenText(language, 'agentProposePhoneA')}`, session: next };
    }
    if (input === '2') {
      const next: UssdSessionRecord = { step: UssdStep.MAIN_MENU, collected: session.collected };
      return { response: `CON ${screenText(language, 'mainMenu')}`, session: next };
    }
    return { response: `CON ${withInvalidPrefix(language, screenText(language, 'agentMenu'))}`, session };
  }

  private handleAgentProposePhoneA(session: UssdSessionRecord, input: string): StepResult {
    const language = session.collected.language ?? 'ha';
    if (!/^(\+?\d{10,15})$/.test(input)) {
      return {
        response: `CON ${withInvalidPrefix(language, screenText(language, 'agentProposePhoneA'))}`,
        session,
      };
    }
    const collected: CollectedData = { ...session.collected, proposePhoneA: input };
    const next: UssdSessionRecord = { step: UssdStep.AGENT_PROPOSE_PHONE_B, collected };
    return { response: `CON ${screenText(language, 'agentProposePhoneB')}`, session: next };
  }

  private async handleAgentProposePhoneB(session: UssdSessionRecord, input: string): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    if (!/^(\+?\d{10,15})$/.test(input)) {
      return {
        response: `CON ${withInvalidPrefix(language, screenText(language, 'agentProposePhoneB'))}`,
        session,
      };
    }

    const phoneA = session.collected.proposePhoneA ?? '';
    const result = await this.matchingService.evaluateProposal(phoneA, input);
    if (!result.ok) {
      const key = result.reason === 'not_found' ? 'proposeUserNotFound' : 'proposeIneligible';
      return { response: `END ${screenText(language, key)}`, session: null };
    }

    const collected: CollectedData = {
      ...session.collected,
      proposal: { userAId: result.userA.id, userBId: result.userB.id, summary: result.summary },
    };
    const next: UssdSessionRecord = { step: UssdStep.AGENT_PROPOSE_CONFIRM, collected };
    return { response: `CON ${proposeConfirmScreen(language, result.summary)}`, session: next };
  }

  private async handleAgentProposeConfirm(
    session: UssdSessionRecord,
    input: string,
    agentPhoneNumber: string,
  ): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    const proposal = session.collected.proposal;
    if (!proposal) {
      return { response: `END ${screenText(language, 'proposeCancelled')}`, session: null };
    }

    if (input === '1') {
      const agent = await this.agentsService.findByPhone(agentPhoneNumber);
      if (agent) {
        await this.matchingService.createProposal(agent.id, proposal.userAId, proposal.userBId);
      }
      return { response: `END ${screenText(language, 'proposeSent')}`, session: null };
    }
    if (input === '2') {
      return { response: `END ${screenText(language, 'proposeCancelled')}`, session: null };
    }
    return {
      response: `CON ${withInvalidPrefix(language, proposeConfirmScreen(language, proposal.summary))}`,
      session,
    };
  }

  private async handleMyMatchesConfirm(
    session: UssdSessionRecord,
    input: string,
    phoneNumber: string,
  ): Promise<StepResult> {
    const language = session.collected.language ?? 'ha';
    const giftContext = session.collected.giftContext;
    if (!giftContext) {
      return { response: `END ${screenText(language, 'proposeCancelled')}`, session: null };
    }

    if (input === '1') {
      const found = await this.matchingService.findActiveMatchForUser(phoneNumber);
      if (found && found.match.id === giftContext.matchId) {
        const sender = found.match.userAId === found.partner.id ? found.match.userB : found.match.userA;
        if (sender) {
          await this.airtimeService.sendCourtingGesture(sender, found.partner);
        }
      }
      return { response: `END ${screenText(language, 'giftSent')}`, session: null };
    }
    if (input === '2') {
      return { response: `END ${screenText(language, 'proposeCancelled')}`, session: null };
    }
    return {
      response: `CON ${withInvalidPrefix(language, screenText(language, 'myMatchesConfirm'))}`,
      session,
    };
  }

  /** Renders the CON prompt for a step being resumed into, without re-running its handler. */
  private promptFor(session: UssdSessionRecord): string {
    const language = session.collected.language ?? 'ha';
    switch (session.step) {
      case UssdStep.MAIN_MENU:
        return screenText(language, 'mainMenu');
      case UssdStep.REGISTER_NAME:
        return screenText(language, 'registerName');
      case UssdStep.REGISTER_AGE:
        return screenText(language, 'registerAge');
      case UssdStep.REGISTER_LGA:
        return screenText(language, 'registerLga');
      case UssdStep.REGISTER_INTENT:
        return screenText(language, 'registerIntent');
      case UssdStep.REGISTER_INTERESTS:
        return screenText(language, 'registerInterests');
      case UssdStep.REGISTER_GUARDIAN_PHONE:
        return screenText(language, 'registerGuardianPhone');
      case UssdStep.AGENT_NAME:
        return screenText(language, 'agentName');
      case UssdStep.AGENT_LGA:
        return screenText(language, 'agentLga');
      case UssdStep.AGENT_MENU:
        return screenText(language, 'agentMenu');
      case UssdStep.AGENT_PROPOSE_PHONE_A:
        return screenText(language, 'agentProposePhoneA');
      case UssdStep.AGENT_PROPOSE_PHONE_B:
        return screenText(language, 'agentProposePhoneB');
      case UssdStep.AGENT_PROPOSE_CONFIRM:
        return session.collected.proposal
          ? proposeConfirmScreen(language, session.collected.proposal.summary)
          : screenText(language, 'agentMenu');
      case UssdStep.MY_MATCHES_CONFIRM:
        return screenText(language, 'myMatchesConfirm');
      default:
        return WELCOME_SCREEN;
    }
  }

  /**
   * Persists the completed registration (TRD §4.1: users row created on the final
   * USSD step) and fires the confirmation SMS asynchronously so the AT response
   * timeout is never blocked on the SMS round-trip.
   */
  private async finalizeRegistration(phoneNumber: string, collected: CollectedData): Promise<string> {
    const language = collected.language ?? 'ha';
    const intentType = collected.intentType as IntentType;
    const isMarriage = intentType === 'marriage';

    const user = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const guardianRepo = manager.getRepository(Guardian);

      let savedUser = await userRepo.save(
        userRepo.create({
          phoneNumber,
          name: collected.name ?? null,
          ageBracket: collected.ageBracket ?? null,
          lga: collected.lga ?? null,
          language,
          intentType,
          interestTags: collected.interestTags ?? null,
          consentStatus: isMarriage ? 'pending' : 'not_required',
          status: isMarriage ? 'pending_consent' : 'active',
        }),
      );

      if (isMarriage && collected.guardianPhone) {
        const guardian = await guardianRepo.save(
          guardianRepo.create({
            phoneNumber: collected.guardianPhone,
            linkedUserId: savedUser.id,
            consentResponse: null,
            respondedAt: null,
          }),
        );
        savedUser = await userRepo.save({ ...savedUser, guardianId: guardian.id });
      }

      return savedUser;
    });

    this.logger.log(`Registered user ${user.id} (${phoneNumber}), intent=${intentType}`);

    if (isMarriage && collected.guardianPhone) {
      this.consentService.sendConsentRequest(collected.guardianPhone, collected.name ?? '', language);
    }

    const confirmationText = smsConfirmation(language, collected.name ?? '', intentType);
    // Fire-and-forget: never block the USSD response on the SMS round-trip (TRD §4.1).
    this.smsService
      .send(phoneNumber, confirmationText)
      .catch((err: unknown) => this.logger.error(`Confirmation SMS failed for ${phoneNumber}`, err));

    // PRD §5.3: notify verified agents covering this LGA of the new registrant.
    this.agentsService.notifyMatchingAgents(user);

    return `END ${screenText(language, isMarriage ? 'confirmationMarriage' : 'confirmationOther')}`;
  }

  /**
   * Registers (or re-registers) a Rabta Agent and kicks off Voice OTP verification
   * (TRD §4.3): OTP code stored in Redis, sent by SMS, and an outbound call placed
   * so the agent can enter it via DTMF. All fire-and-forget — never blocks the USSD reply.
   */
  private async finalizeAgentRegistration(
    phoneNumber: string,
    name: string,
    coverageLga: string,
    language: Language,
  ): Promise<string> {
    const agent = await this.agentsService.registerOrUpdate(phoneNumber, name, coverageLga);
    this.logger.log(`Agent ${agent.id} (${phoneNumber}) registered/updated, coverageLga=${coverageLga}`);

    if (agent.verified) {
      return `END ${screenText(language, 'agentAlreadyVerified')}`;
    }

    await this.agentsService.startVerification(agent);
    return `END ${screenText(language, 'agentCallPending')}`;
  }
}
