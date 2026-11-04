import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // confia em um único proxy na frente
  app.enableShutdownHooks();
  app.use(cookieParser())

  const env = app.get<Env>(ENV);
  await app.listen(env.API_PORT);
}
bootstrap();