import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Stricter than the app default: stops an attacker SMS-bombing a real agent's phone for free. */
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('request-otp')
  async requestOtp(@Body() dto: RequestOtpDto): Promise<{ sent: true }> {
    await this.authService.requestOtp(dto.phoneNumber);
    return { sent: true };
  }

  /**
   * The OTP is already single-shot (consumed on any attempt, see auth.service.ts),
   * which caps a real attacker to one guess per SMS-derived code regardless. This
   * is defense in depth against hammering the endpoint itself.
   */
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<{ accessToken: string }> {
    return this.authService.verifyOtp(dto.phoneNumber, dto.code);
  }
}
