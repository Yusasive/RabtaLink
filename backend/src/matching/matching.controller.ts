import { Controller, NotFoundException, Param, Post } from '@nestjs/common';
import { MatchingService } from './matching.service';

@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

  /** Manual trigger for the weekly digest — lets it be verified without waiting a week. */
  @Post('digest/run')
  async runDigest() {
    await this.matchingService.runWeeklyDigest();
    return { triggered: true };
  }

  /** Manual trigger for the call-scheduling sweep — lets it be verified without waiting for the poll interval. */
  @Post('scheduling/run')
  async runScheduling() {
    await this.matchingService.triggerScheduledCalls();
    return { triggered: true };
  }

  /**
   * TRD §8: stands in for a real post-call webhook (M6 scope) — an admin marks a
   * match's call as completed, which the M5 reward sweep then picks up.
   */
  @Post(':id/complete-call')
  async completeCall(@Param('id') id: string) {
    const match = await this.matchingService.markCallCompleted(id);
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }
}
