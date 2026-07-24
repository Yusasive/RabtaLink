import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Agent } from '../database/entities/agent.entity';
import { AirtimeTransaction } from '../database/entities/airtime-transaction.entity';
import { Match } from '../database/entities/match.entity';
import { User } from '../database/entities/user.entity';
import { EligibilityResult, MatchingService } from '../matching/matching.service';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function clampLimit(limit?: number): number {
  if (!limit || Number.isNaN(limit) || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface RegistrantDto {
  id: string;
  name: string | null;
  phoneNumber: string;
  intentType: string;
  lga: string | null;
  ageBracket: string | null;
  consentStatus: string;
  status: string;
  needsAction: boolean;
}

export interface MatchDto {
  id: string;
  status: string;
  userAName: string | null;
  userBName: string | null;
  scheduledCallTime: Date | null;
  callCompleted: boolean;
  createdAt: Date;
}

export interface RewardsDto {
  totalRewardsEarned: number;
  transactions: Paginated<{ id: string; amount: number; createdAt: Date; atTransactionId: string | null }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(Agent) private readonly agentRepo: Repository<Agent>,
    @InjectRepository(AirtimeTransaction) private readonly txRepo: Repository<AirtimeTransaction>,
    private readonly matchingService: MatchingService,
  ) {}

  /**
   * UI-UX §6.2.1: "assigned registrants" = users in the agent's coverage LGA
   * (same scoping M3's notification uses), sorted "needs action" first — a
   * marriage-intent registrant still awaiting guardian consent, or anyone
   * active with no match yet, both need the agent's attention before anyone else.
   *
   * Sorting depends on seeing every registrant's match state at once, so this
   * loads the full per-LGA set and sorts in memory (fine at realistic LGA
   * scale — hundreds, not millions) but only *sends* one page of it back —
   * that's the part that would otherwise grow unbounded as an LGA fills up.
   */
  async getRegistrants(agentId: string, limit?: number, offset = 0): Promise<Paginated<RegistrantDto>> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const pageSize = clampLimit(limit);
    if (!agent.coverageLga) return { items: [], total: 0, limit: pageSize, offset };

    const users = await this.userRepo.find({ where: { lga: agent.coverageLga }, order: { createdAt: 'DESC' } });
    if (users.length === 0) return { items: [], total: 0, limit: pageSize, offset };

    const userIds = users.map((u) => u.id);
    const activeMatches = await this.matchRepo.find({
      where: [
        { userAId: In(userIds), status: Not('declined') },
        { userBId: In(userIds), status: Not('declined') },
      ],
    });
    const idsWithActiveMatch = new Set(activeMatches.flatMap((m) => [m.userAId, m.userBId]));

    const dtos: RegistrantDto[] = users.map((u) => {
      const pendingConsent = u.consentStatus === 'pending';
      return {
        id: u.id,
        name: u.name,
        phoneNumber: u.phoneNumber,
        intentType: u.intentType,
        lga: u.lga,
        ageBracket: u.ageBracket,
        consentStatus: u.consentStatus,
        status: u.status,
        needsAction: pendingConsent || (u.status === 'active' && !idsWithActiveMatch.has(u.id)),
      };
    });

    const rank = (d: RegistrantDto) => (d.consentStatus === 'pending' ? 0 : d.needsAction ? 1 : 2);
    const sorted = dtos.sort((a, b) => rank(a) - rank(b));
    return { items: sorted.slice(offset, offset + pageSize), total: sorted.length, limit: pageSize, offset };
  }

  async evaluateMatch(phoneA: string, phoneB: string): Promise<EligibilityResult> {
    return this.matchingService.evaluateProposal(phoneA, phoneB);
  }

  async proposeMatch(agentId: string, phoneA: string, phoneB: string): Promise<Match> {
    const result = await this.matchingService.evaluateProposal(phoneA, phoneB);
    if (!result.ok) {
      throw new NotFoundException(result.reason === 'not_found' ? 'One or both numbers not found' : 'Not eligible for a match');
    }
    return this.matchingService.createProposal(agentId, result.userA.id, result.userB.id);
  }

  /** UI-UX §6.2.3 kanban tracker — matches this agent proposed. */
  async getMatches(agentId: string, limit?: number, offset = 0): Promise<Paginated<MatchDto>> {
    const pageSize = clampLimit(limit);
    const [matches, total] = await this.matchRepo.findAndCount({
      where: { proposedByAgentId: agentId },
      relations: { userA: true, userB: true },
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: offset,
    });
    return {
      items: matches.map((m) => ({
        id: m.id,
        status: m.status,
        userAName: m.userA?.name ?? null,
        userBName: m.userB?.name ?? null,
        scheduledCallTime: m.scheduledCallTime,
        callCompleted: m.callCompleted,
        createdAt: m.createdAt,
      })),
      total,
      limit: pageSize,
      offset,
    };
  }

  /** UI-UX §6.2.4 reward ledger. */
  async getRewards(agentId: string, limit?: number, offset = 0): Promise<RewardsDto> {
    const agent = await this.agentRepo.findOne({ where: { id: agentId } });
    if (!agent) throw new NotFoundException('Agent not found');
    const pageSize = clampLimit(limit);

    const [transactions, total] = await this.txRepo.findAndCount({
      where: { recipientType: 'agent', recipientId: agentId },
      order: { createdAt: 'DESC' },
      take: pageSize,
      skip: offset,
    });
    return {
      totalRewardsEarned: agent.totalRewardsEarned,
      transactions: {
        items: transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          createdAt: t.createdAt,
          atTransactionId: t.atTransactionId,
        })),
        total,
        limit: pageSize,
        offset,
      },
    };
  }
}
