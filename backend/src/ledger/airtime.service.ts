import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import { Agent } from '../database/entities/agent.entity';
import { AirtimeTransaction } from '../database/entities/airtime-transaction.entity';
import { Match } from '../database/entities/match.entity';
import { User } from '../database/entities/user.entity';
import { AGENT_REWARD_AMOUNT_NGN, COURTING_GESTURE_AMOUNT_NGN, agentRewardSms, giftReceivedSms } from './ledger-copy.constants';

// AT's Airtime API response shape for a successful send isn't independently
// confirmed in this environment (M0/M3 already found the sandbox unreachable for
// some products) — this is a best-effort extraction, not a verified contract.
function extractTransactionId(response: unknown): string | null {
  const responses = (response as { responses?: { transactionId?: string }[] } | undefined)?.responses;
  return responses?.[0]?.transactionId ?? null;
}

@Injectable()
export class AirtimeService {
  private readonly logger = new Logger(AirtimeService.name);

  constructor(
    @InjectRepository(AirtimeTransaction) private readonly txRepo: Repository<AirtimeTransaction>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    private readonly africasTalking: AfricasTalkingService,
  ) {}

  /**
   * M0 stub: proves the Airtime send round-trip against the AT sandbox.
   */
  sendTest(phoneNumber: string, amountNaira: number) {
    return this.africasTalking.sendAirtime([
      { phoneNumber, amount: amountNaira, currencyCode: 'NGN' },
    ]);
  }

  /**
   * PRD §5.6 courting gesture. The ledger row is written synchronously (it's the
   * fact we're recording), while the actual AT send + recipient SMS are
   * fire-and-forget so the USSD response is never blocked on either.
   */
  async sendCourtingGesture(sender: User, recipient: User): Promise<AirtimeTransaction> {
    const tx = await this.txRepo.save(
      this.txRepo.create({
        senderType: 'user',
        senderId: sender.id,
        recipientId: recipient.id,
        recipientType: 'user',
        amount: COURTING_GESTURE_AMOUNT_NGN,
        reason: 'courting_gesture',
        atTransactionId: null,
      }),
    );

    this.africasTalking
      .sendAirtime([{ phoneNumber: recipient.phoneNumber, amount: COURTING_GESTURE_AMOUNT_NGN, currencyCode: 'NGN' }])
      .then((response) => {
        const atTransactionId = extractTransactionId(response);
        if (atTransactionId) {
          return this.txRepo.update(tx.id, { atTransactionId });
        }
      })
      .catch((err: unknown) => this.logger.error(`Courting gesture airtime send failed for ${recipient.phoneNumber}`, err));

    this.africasTalking
      .sendSms(recipient.phoneNumber, giftReceivedSms(recipient.language, sender.name ?? ''))
      .catch((err: unknown) => this.logger.error(`Gift notification SMS failed for ${recipient.phoneNumber}`, err));

    this.logger.log(`Courting gesture logged: ${sender.id} -> ${recipient.id} (tx ${tx.id})`);
    return tx;
  }

  /**
   * PRD §5.3/TRD §4.4: system-initiated agent reward. Polls for matches flagged
   * call_completed (manually, until M6's real webhook exists) and not yet rewarded.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async processAgentRewards(): Promise<void> {
    const dueMatches = await this.matchRepo.find({ where: { callCompleted: true, rewardIssued: false } });

    for (const match of dueMatches) {
      if (!match.proposedByAgentId) {
        // "NULL = system-suggested" per TRD §3 — no agent to reward, mark resolved so it's not rechecked forever.
        await this.matchRepo.update({ id: match.id, rewardIssued: false }, { rewardIssued: true });
        continue;
      }

      const agent = await this.agentRepo.findOne({ where: { id: match.proposedByAgentId } });
      if (!agent) continue;

      // Atomic claim: the WHERE clause includes rewardIssued: false, so if this
      // cron overlaps another run (or a manual trigger) racing the same match,
      // only one of them flips the row and the other sees affected === 0 below —
      // preventing a double payout, not just a lost-update on the total.
      const claim = await this.matchRepo.update({ id: match.id, rewardIssued: false }, { rewardIssued: true });
      if (!claim.affected) continue;

      const tx = await this.txRepo.save(
        this.txRepo.create({
          senderType: 'system',
          senderId: null,
          recipientId: agent.id,
          recipientType: 'agent',
          amount: AGENT_REWARD_AMOUNT_NGN,
          reason: 'agent_reward',
          atTransactionId: null,
        }),
      );
      await this.agentRepo.increment({ id: agent.id }, 'totalRewardsEarned', AGENT_REWARD_AMOUNT_NGN);

      this.africasTalking
        .sendAirtime([{ phoneNumber: agent.phoneNumber, amount: AGENT_REWARD_AMOUNT_NGN, currencyCode: 'NGN' }])
        .then((response) => {
          const atTransactionId = extractTransactionId(response);
          if (atTransactionId) {
            return this.txRepo.update(tx.id, { atTransactionId });
          }
        })
        .catch((err: unknown) => this.logger.error(`Agent reward airtime send failed for ${agent.phoneNumber}`, err));

      this.africasTalking
        .sendSms(agent.phoneNumber, agentRewardSms())
        .catch((err: unknown) => this.logger.error(`Agent reward SMS failed for ${agent.phoneNumber}`, err));

      this.logger.log(`Agent ${agent.id} rewarded for match ${match.id} (tx ${tx.id})`);
    }
  }
}
