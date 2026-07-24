import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Guardian } from '../database/entities/guardian.entity';
import { Language, User } from '../database/entities/user.entity';
import { AfricasTalkingService } from '../africastalking/africastalking.service';
import {
  consentReminderSms,
  consentRequestSms,
  registrantApprovedSms,
  registrantDeclinedSms,
} from './consent-copy.constants';

const REMINDER_AFTER_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(
    @InjectRepository(Guardian) private readonly guardianRepo: Repository<Guardian>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly africasTalking: AfricasTalkingService,
  ) {}

  /** Fired once, right after a marriage-intent registration creates its guardian row (M1). */
  sendConsentRequest(guardianPhone: string, registrantName: string, language: Language): void {
    const message = consentRequestSms(language, registrantName);
    this.africasTalking
      .sendSms(guardianPhone, message)
      .catch((err: unknown) => this.logger.error(`Consent request SMS failed for ${guardianPhone}`, err));
  }

  /**
   * AT's inbound SMS webhook calls this for every message. Only messages from a
   * phone number with a still-pending guardian record, replying YES/NO, do anything.
   */
  async handleInboundReply(from: string, rawText: string): Promise<void> {
    const decision = this.parseDecision(rawText);
    if (!decision) return;

    const guardian = await this.guardianRepo.findOne({
      where: { phoneNumber: from, consentResponse: IsNull() },
      relations: { linkedUser: true },
    });
    if (!guardian) {
      this.logger.log(`No pending guardian consent found for ${from}`);
      return;
    }

    const approved = decision === 'yes';
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Guardian).update(guardian.id, {
        consentResponse: decision,
        respondedAt: new Date(),
      });
      if (guardian.linkedUserId) {
        await manager.getRepository(User).update(guardian.linkedUserId, {
          consentStatus: approved ? 'approved' : 'declined',
          status: approved ? 'active' : 'pending_consent',
        });
      }
    });

    this.logger.log(`Guardian ${guardian.id} responded ${decision} for user ${guardian.linkedUserId}`);
    this.notifyRegistrant(guardian, approved);
  }

  private notifyRegistrant(guardian: Guardian, approved: boolean): void {
    const registrant = guardian.linkedUser;
    if (!registrant) return;
    const message = approved
      ? registrantApprovedSms(registrant.language)
      : registrantDeclinedSms(registrant.language);
    this.africasTalking
      .sendSms(registrant.phoneNumber, message)
      .catch((err: unknown) => this.logger.error(`Consent-result SMS failed for ${registrant.phoneNumber}`, err));
  }

  private parseDecision(rawText: string): 'yes' | 'no' | null {
    const text = rawText.trim();
    if (/^yes\b/i.test(text)) return 'yes';
    if (/^no\b/i.test(text)) return 'no';
    return null;
  }

  /** PRD §9: auto-reminder after 24h of guardian silence. Polls every 30 min. */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async sendReminders(): Promise<void> {
    const cutoff = new Date(Date.now() - REMINDER_AFTER_MS);
    const overdue = await this.guardianRepo.find({
      where: {
        consentResponse: IsNull(),
        reminderSentAt: IsNull(),
        createdAt: LessThanOrEqual(cutoff),
        linkedUserId: Not(IsNull()),
      },
      relations: { linkedUser: true },
    });

    for (const guardian of overdue) {
      if (!guardian.linkedUser) continue;
      const message = consentReminderSms(guardian.linkedUser.language, guardian.linkedUser.name ?? '');
      try {
        await this.africasTalking.sendSms(guardian.phoneNumber, message);
        await this.guardianRepo.update(guardian.id, { reminderSentAt: new Date() });
        this.logger.log(`Sent 24h consent reminder to guardian ${guardian.id}`);
      } catch (err) {
        this.logger.error(`Consent reminder SMS failed for ${guardian.phoneNumber}`, err);
      }
    }
  }
}
