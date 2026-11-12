import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { CLICK_QUEUE_NAME } from '@shortener/shared';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { ClickPublisherService } from './click-publisher.service.js';
import { CLICK_QUEUE, QUEUE_REDIS } from './queue.constants.js';

const logger = new Logger('ClickQueue');    

@Module({
  providers: [
    {
      // Conexão própria da fila: falha rápida quando o Redis cai
      provide: QUEUE_REDIS,
      inject: [ENV],
      useFactory: (env: Env) => {
        const connection = new Redis(env.REDIS_URL, { enableOfflineQueue: false });
        connection.on('error', (err) => logger.warn(`Queue Redis: ${err.message}`));
        return connection;
      },
    },
    {
      provide: CLICK_QUEUE,
      inject: [QUEUE_REDIS],
      useFactory: (connection: Redis) => {
        const queue = new Queue(CLICK_QUEUE_NAME, {
          connection,
          defaultJobOptions: {
            attempts: 5,
            backoff: { type: 'exponential', delay: 1000 },
            // Obrigatório com noeviction: sem isso a fila enche a memória do Redis
            removeOnComplete: { age: 60 * 60, count: 1000 },
            removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
          },
        });
        queue.on('error', (err) => logger.warn(`Fila: ${err.message}`));
        return queue;
      },
    },
    ClickPublisherService
  ],
  exports: [ClickPublisherService],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(CLICK_QUEUE) private readonly queue: Queue,
    @Inject(QUEUE_REDIS) private readonly connection: Redis,
  ) {}

  async onApplicationShutdown() {
    try {
      await this.queue.close();
      await this.connection.quit();
    } catch {
      this.connection.disconnect(); // Redis fora do ar: não deixa o app.close() pendurado
    }
  }
}