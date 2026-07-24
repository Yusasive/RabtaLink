import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AgentJwtPayload } from './auth.service';

export interface AuthenticatedRequest extends Request {
  agent: AgentJwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      request.agent = await this.jwtService.verifyAsync<AgentJwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
