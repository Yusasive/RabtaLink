import { Controller, Post } from '@nestjs/common';
import { ConsentService } from './consent.service';

@Controller('consent')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  /** Manual trigger for the 24h reminder sweep — lets it be verified without waiting 24h. */
  @Post('reminders/run')
  async runReminders() {
    await this.consentService.sendReminders();
    return { triggered: true };
  }
}
