import { Body, Controller, Post } from '@nestjs/common';
import { AirtimeService } from './airtime.service';
import { SendTestAirtimeDto } from './dto/send-test-airtime.dto';

@Controller('airtime')
export class AirtimeController {
  constructor(private readonly airtimeService: AirtimeService) {}

  @Post('test-send')
  testSend(@Body() dto: SendTestAirtimeDto) {
    return this.airtimeService.sendTest(dto.phoneNumber, dto.amountNaira);
  }

  /** Manual trigger for the agent-reward sweep — lets it be verified without waiting for the poll interval. */
  @Post('rewards/run')
  async runRewards() {
    await this.airtimeService.processAgentRewards();
    return { triggered: true };
  }
}
