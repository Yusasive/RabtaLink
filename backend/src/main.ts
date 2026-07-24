import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  app.enableCors({ origin: config.get<string>('dashboardOrigin'), credentials: true });

  await app.listen(port);
  console.log(`RabtaLink API listening on port ${port}`);
}

void bootstrap();
