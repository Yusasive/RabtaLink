import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ActivityLogService } from '../activity/activity-log.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

class EvaluateMatchDto {
  @IsString()
  @IsNotEmpty()
  phoneA!: string;

  @IsString()
  @IsNotEmpty()
  phoneB!: string;
}

function parseIntParam(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly activityLog: ActivityLogService,
  ) {}

  @Get('registrants')
  getRegistrants(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.dashboardService.getRegistrants(req.agent.sub, parseIntParam(limit), parseIntParam(offset) ?? 0);
  }

  @Post('matches/evaluate')
  evaluateMatch(@Body() dto: EvaluateMatchDto) {
    return this.dashboardService.evaluateMatch(dto.phoneA, dto.phoneB);
  }

  @Post('matches/propose')
  proposeMatch(@Req() req: AuthenticatedRequest, @Body() dto: EvaluateMatchDto) {
    return this.dashboardService.proposeMatch(req.agent.sub, dto.phoneA, dto.phoneB);
  }

  @Get('matches')
  getMatches(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.dashboardService.getMatches(req.agent.sub, parseIntParam(limit), parseIntParam(offset) ?? 0);
  }

  @Get('rewards')
  getRewards(@Req() req: AuthenticatedRequest, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.dashboardService.getRewards(req.agent.sub, parseIntParam(limit), parseIntParam(offset) ?? 0);
  }

  /** M9 demo-mode judge screen: live USSD/SMS/Voice/Airtime activity, polled by the frontend. */
  @Get('activity')
  getActivity(@Query('limit') limit?: string) {
    return {
      events: this.activityLog.getRecent(parseIntParam(limit) ?? 50),
      counts: this.activityLog.getCountsByChannel(),
    };
  }
}
