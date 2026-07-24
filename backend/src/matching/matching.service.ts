import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, In, Not, Repository } from 'typeorm';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { normalizeLga } from '../common/normalize-lga';
import { Guardian } from '../database/entities/guardian.entity';
import { Match, MatchStatus } from '../database/entities/match.entity';
import { User } from '../database/entities/user.entity';
import { RedisService } from '../redis/redis.service';
import { bothAcceptedSms, declinedSms, digestSms, proposalSms } from './match-copy.constants';
import { nextMatchStatus, parseMatchDecision } from './match-status';
import { precallPromptSms } from './taaruf-copy.constants';

const MAX_DIGEST_SUGGESTIONS = 3;
const UNRESOLVED_STATUSES: MatchStatus[] = [
  'proposed',
  'accepted_a',
  'accepted_b',
  'both_accepted',
  'call_scheduled',
];

// M6 scope simplification: no UI exists for two registrants to negotiate a call
// time, so the system auto-schedules a short, fixed delay after both_accepted
// rather than an agreed time — demoable without a scheduling negotiation flow.
const CALL_SCHEDULE_DELAY_MS = 10 * 60 * 1000;
const BRIDGING_LOCK_TTL_SECONDS = 20 * 60;

function conferenceLockKey(matchId: string): string {
  return `voice:bridging:${matchId}`;
}

export function conferenceMarkerKey(phoneNumber: string): string {
  return `voice:conference:${phoneNumber}`;
}

export type EligibilityResult =
  | { ok: true; userA: User; userB: User; summary: string }
  | { ok: false; reason: 'not_found' | 'ineligible' };

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Guardian) private readonly guardianRepo: Repository<Guardian>,
    private readonly africasTalking: AfricasTalkingService,
    private readonly redis: RedisService,
  ) {}

  /** Rule-based only, per PRD §7 — no ML. Intent + LGA are hard gates; age/interests are descriptive. */
  private async checkEligibility(phoneA: string, phoneB: string): Promise<EligibilityResult> {
    const [userA, userB] = await Promise.all([
      this.userRepo.findOne({ where: { phoneNumber: phoneA } }),
      this.userRepo.findOne({ where: { phoneNumber: phoneB } }),
    ]);
    if (!userA || !userB) return { ok: false, reason: 'not_found' };

    if (
      userA.id === userB.id ||
      userA.status !== 'active' ||
      userB.status !== 'active' ||
      userA.intentType !== userB.intentType ||
      !userA.lga ||
      !userB.lga ||
      normalizeLga(userA.lga) !== normalizeLga(userB.lga)
    ) {
      return { ok: false, reason: 'ineligible' };
    }

    const existing = await this.matchRepo.findOne({
      where: [
        { userAId: userA.id, userBId: userB.id, status: In(UNRESOLVED_STATUSES) },
        { userAId: userB.id, userBId: userA.id, status: In(UNRESOLVED_STATUSES) },
      ],
    });
    if (existing) return { ok: false, reason: 'ineligible' };

    const sharedInterests = (userA.interestTags ?? []).filter((tag) =>
      (userB.interestTags ?? []).includes(tag),
    ).length;
    const summary = `LGA: ${userA.lga}. Shekaru: ${userA.ageBracket ?? '?'}/${userB.ageBracket ?? '?'}. Sha'awa iri daya: ${sharedInterests}.`;

    return { ok: true, userA, userB, summary };
  }

  async evaluateProposal(phoneA: string, phoneB: string): Promise<EligibilityResult> {
    return this.checkEligibility(phoneA, phoneB);
  }

  /** Read side of the Redis marker `bridgeCall` writes — checked by the Voice callback. */
  async getConferenceMarker(phoneNumber: string): Promise<{ matchId: string; guardianIncluded: boolean } | null> {
    const raw = await this.redis.get(conferenceMarkerKey(phoneNumber));
    return raw ? (JSON.parse(raw) as { matchId: string; guardianIncluded: boolean }) : null;
  }

  /**
   * M5's "matched candidate" for a courting gesture (PRD §5.6): the user's most
   * recent non-declined match, whichever stage it's at — the gesture is framed as
   * a way to show interest, not gated to post-acceptance.
   */
  async findActiveMatchForUser(phoneNumber: string): Promise<{ match: Match; partner: User } | null> {
    const user = await this.userRepo.findOne({ where: { phoneNumber } });
    if (!user) return null;

    const match = await this.matchRepo.findOne({
      where: [
        { userAId: user.id, status: Not('declined') },
        { userBId: user.id, status: Not('declined') },
      ],
      relations: { userA: true, userB: true },
      order: { createdAt: 'DESC' },
    });
    if (!match || !match.userA || !match.userB) return null;

    const partner = match.userAId === user.id ? match.userB : match.userA;
    return { match, partner };
  }

  /**
   * TRD §8: no real post-call webhook exists yet (that's M6), so this is the
   * sanctioned manual admin action standing in for one until then.
   */
  async markCallCompleted(matchId: string): Promise<Match | null> {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) return null;
    await this.matchRepo.update(matchId, { callCompleted: true });
    this.logger.log(`Match ${matchId} manually marked call_completed=true`);
    return { ...match, callCompleted: true };
  }

  async createProposal(agentId: string, userAId: string, userBId: string): Promise<Match> {
    const match = await this.matchRepo.save(
      this.matchRepo.create({
        userAId,
        userBId,
        proposedByAgentId: agentId,
        status: 'proposed',
      }),
    );

    const [userA, userB] = await Promise.all([
      this.userRepo.findOneOrFail({ where: { id: userAId } }),
      this.userRepo.findOneOrFail({ where: { id: userBId } }),
    ]);
    for (const user of [userA, userB]) {
      this.africasTalking
        .sendSms(user.phoneNumber, proposalSms(user.language))
        .catch((err: unknown) => this.logger.error(`Match proposal SMS failed for ${user.phoneNumber}`, err));
    }

    this.logger.log(`Match ${match.id} proposed by agent ${agentId} between ${userAId} and ${userBId}`);
    return match;
  }

  /**
   * SMS reply "1"/"2" from either matched party. TRD has no per-user response
   * columns, just one `status` enum, so acceptance is tracked as accepted_a/accepted_b
   * until both sides have responded.
   */
  async handleInboundReply(from: string, rawText: string): Promise<void> {
    const decision = parseMatchDecision(rawText);
    if (!decision) return;

    const replier = await this.userRepo.findOne({ where: { phoneNumber: from } });
    if (!replier) return;

    const match = await this.matchRepo.findOne({
      where: [
        { userAId: replier.id, status: In(UNRESOLVED_STATUSES) },
        { userBId: replier.id, status: In(UNRESOLVED_STATUSES) },
      ],
      relations: { userA: true, userB: true },
      order: { createdAt: 'DESC' },
    });
    if (!match || !match.userA || !match.userB) {
      this.logger.log(`No pending match found for ${from}`);
      return;
    }

    const isUserA = match.userAId === replier.id;
    const other = isUserA ? match.userB : match.userA;
    const nextStatus = nextMatchStatus(match.status, isUserA, decision);
    if (!nextStatus) return; // already responded from this side, or nothing actionable

    await this.matchRepo.update(match.id, { status: nextStatus });
    this.logger.log(`Match ${match.id} -> ${nextStatus} (${from} replied ${decision})`);

    if (nextStatus === 'both_accepted') {
      for (const user of [match.userA, match.userB]) {
        this.africasTalking
          .sendSms(user.phoneNumber, bothAcceptedSms(user.language))
          .catch((err: unknown) => this.logger.error(`Both-accepted SMS failed for ${user.phoneNumber}`, err));
      }
      await this.scheduleCall(match, match.userA, match.userB);
    } else if (nextStatus === 'declined') {
      this.africasTalking
        .sendSms(other.phoneNumber, declinedSms(other.language))
        .catch((err: unknown) => this.logger.error(`Declined-notice SMS failed for ${other.phoneNumber}`, err));
    }
  }

  /**
   * M6: once both parties accept, auto-schedule the Ta'aruf call a short fixed
   * delay out (see CALL_SCHEDULE_DELAY_MS note above) and send the pre-call
   * prompt-sheet SMS (UI-UX §4) to both parties and any attached guardians.
   */
  private async scheduleCall(match: Match, userA: User, userB: User): Promise<void> {
    const guardianIncluded =
      userA.intentType === 'marriage' && (Boolean(userA.guardianId) || Boolean(userB.guardianId));
    const scheduledCallTime = new Date(Date.now() + CALL_SCHEDULE_DELAY_MS);

    await this.matchRepo.update(match.id, { status: 'call_scheduled', scheduledCallTime, guardianIncluded });
    this.logger.log(`Match ${match.id} call scheduled for ${scheduledCallTime.toISOString()}`);

    const timeLabel = scheduledCallTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    for (const user of [userA, userB]) {
      this.africasTalking
        .sendSms(user.phoneNumber, precallPromptSms(user.language, timeLabel))
        .catch((err: unknown) => this.logger.error(`Pre-call prompt SMS failed for ${user.phoneNumber}`, err));
    }

    if (guardianIncluded) {
      const guardians = await this.guardianRepo.find({
        where: [{ linkedUserId: userA.id }, { linkedUserId: userB.id }],
      });
      for (const guardian of guardians) {
        this.africasTalking
          .sendSms(guardian.phoneNumber, precallPromptSms('ha', timeLabel))
          .catch((err: unknown) => this.logger.error(`Pre-call prompt SMS failed for guardian ${guardian.phoneNumber}`, err));
      }
    }
  }

  /**
   * TRD §4.3/§9: places the Voice conference legs once a scheduled call is due.
   * A short Redis lock prevents this 1-minute sweep from double-dialing a match
   * still within the same due window.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async triggerScheduledCalls(): Promise<void> {
    const due = await this.matchRepo.find({
      where: { status: 'call_scheduled', scheduledCallTime: LessThanOrEqual(new Date()) },
    });

    for (const match of due) {
      const alreadyBridging = await this.redis.get(conferenceLockKey(match.id));
      if (alreadyBridging) continue;
      await this.redis.set(conferenceLockKey(match.id), '1', BRIDGING_LOCK_TTL_SECONDS);
      await this.bridgeCall(match);
    }
  }

  private async bridgeCall(match: Match): Promise<void> {
    const [userA, userB] = await Promise.all([
      this.userRepo.findOneOrFail({ where: { id: match.userAId } }),
      this.userRepo.findOneOrFail({ where: { id: match.userBId } }),
    ]);

    const phones = [userA.phoneNumber, userB.phoneNumber];
    if (match.guardianIncluded) {
      const guardians = await this.guardianRepo.find({
        where: [{ linkedUserId: userA.id }, { linkedUserId: userB.id }],
      });
      phones.push(...guardians.map((g) => g.phoneNumber));
    }

    const marker = JSON.stringify({ matchId: match.id, guardianIncluded: match.guardianIncluded });
    for (const phone of phones) {
      await this.redis.set(conferenceMarkerKey(phone), marker, BRIDGING_LOCK_TTL_SECONDS);
      this.africasTalking
        .makeCall(phone)
        .catch((err: unknown) => this.logger.error(`Ta'aruf bridge call failed for ${phone}`, err));
    }

    this.logger.log(`Match ${match.id} bridging call placed to ${phones.length} legs`);
  }

  /**
   * PRD §5.5 weekly digest: a count-only teaser of rule-based candidates per active
   * user, not new proposals — actual proposals still require agent action (Principle 3).
   */
  @Cron(CronExpression.EVERY_WEEK)
  async runWeeklyDigest(): Promise<void> {
    const users = await this.userRepo.find({ where: { status: 'active' } });
    for (const user of users) {
      if (!user.lga) continue;
      const candidates = await this.userRepo.find({
        where: { lga: user.lga, intentType: user.intentType, status: 'active', id: Not(user.id) },
      });
      if (candidates.length === 0) continue;

      const count = Math.min(candidates.length, MAX_DIGEST_SUGGESTIONS);
      try {
        await this.africasTalking.sendSms(user.phoneNumber, digestSms(user.language, count));
      } catch (err) {
        this.logger.error(`Weekly digest SMS failed for ${user.phoneNumber}`, err);
      }
    }
  }
}
