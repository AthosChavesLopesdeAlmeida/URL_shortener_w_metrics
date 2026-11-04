import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api', {
    exclude: [{path: ':code', method: RequestMethod.GET}]
  });
  app.enableShutdownHooks();
  app.use(cookieParser())

  const env = app.get<Env>(ENV);
  await app.listen(env.API_PORT);
}
bootstrap();