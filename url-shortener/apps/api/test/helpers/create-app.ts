import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module.js';

// Deve espelhar o que o main.ts configura (cookie-parser, trust proxy)
export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.set('trust proxy', 1);
  app.use(cookieParser());
  await app.init();
  return app;
}