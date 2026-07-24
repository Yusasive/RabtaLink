import { Body, Controller, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AtWebhookGuard } from '../common/guards/at-webhook.guard';
import { UssdService } from './ussd.service';

// Africa's Talking POSTs application/x-www-form-urlencoded fields on every keystroke:
// sessionId, phoneNumber, networkCode, serviceCode, text (accumulated input so far).
interface AtUssdCallbackBody {
  sessionId: string;
  phoneNumber: string;
  text?: string;
}

@Controller('ussd')
@UseGuards(AtWebhookGuard)
@SkipThrottle()
export class UssdController {
  constructor(private readonly ussdService: UssdService) {}

  @Post('callback')
  @HttpCode(200)
  @Header('Content-Type', 'text/plain')
  callback(@Body() body: AtUssdCallbackBody): Promise<string> {
    return this.ussdService.handle({
      sessionId: body.sessionId,
      phoneNumber: body.phoneNumber,
      text: body.text ?? '',
    });
  }
}
