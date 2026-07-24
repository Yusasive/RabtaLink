import { timingSafeEqual } from 'node:crypto';
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Africa's Talking has no request-signing mechanism for USSD/SMS/Voice callbacks,
 * so anyone who finds these URLs could otherwise POST directly — faking a
 * guardian's "YES", a match "1" accept, or an OTP digit entry without ever going
 * through AT at all. The standard workaround: configure the callback URL in the
 * AT dashboard with a shared-secret query param (`?token=...`), and reject any
 * request that doesn't carry it.
 */
@Injectable()
export class AtWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('atWebhookSecret') ?? '';
    const provided = typeof request.query.token === 'string' ? request.query.token : '';

    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);
    const matches =
      expectedBuf.length > 0 &&
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf);

    if (!matches) throw new UnauthorizedException('Invalid or missing webhook token');
    return true;
  }
}
