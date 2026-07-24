import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([
      this.dataSource
        .query('SELECT 1')
        .then(() => true)
        .catch(() => false),
      this.redis
        .ping()
        .then((pong) => pong === 'PONG')
        .catch(() => false),
    ]);

    return {
      status: dbOk && redisOk ? 'ok' : 'degraded',
      postgres: dbOk,
      redis: redisOk,
    };
  }
}
