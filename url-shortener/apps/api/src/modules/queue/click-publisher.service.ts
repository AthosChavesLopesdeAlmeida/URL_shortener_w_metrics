import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { CreateClickEventInput } from '@shortener/shared';
import { CLICK_QUEUE } from './queue.constants.js';

// Devem acompanhar os limites do clickEventSchema
const MAX_IP = 45;
const MAX_USER_AGENT = 512;
const MAX_REFERRER = 2048;

export type ClickInput = {
  linkId: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
};

const clip = (value: string | null | undefined, max: number): string | null =>
  value ? value.slice(0, max) : null;

@Injectable()
export class ClickPublisherService {
  private readonly logger = new Logger(ClickPublisherService.name);

  constructor(@Inject(CLICK_QUEUE) private readonly queue: Queue) {}

  // Nunca lança erro: perder um clique é aceitável, quebrar o redirect não é
  async publish(input: ClickInput): Promise<void> {
    try {
      const event: CreateClickEventInput = {
        eventId: randomUUID(),
        linkId: input.linkId,
        clickedAt: new Date().toISOString(),
        ip: clip(input.ip, MAX_IP),
        userAgent: clip(input.userAgent, MAX_USER_AGENT),
        referrer: clip(input.referrer, MAX_REFERRER),
      };

      await this.queue.add('click', event, { jobId: event.eventId });
    } catch (err) {
      this.logger.warn(`Clique não enfileirado: ${(err as Error).message}`);
    }
  }
}