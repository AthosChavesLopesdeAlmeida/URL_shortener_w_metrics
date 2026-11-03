import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../../redis/redis.module.js';

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // Guardamos o hash do token: se o Redis vazar, os tokens não servem para nada
  private key(token: string) {
    return `session:${createHash('sha256').update(token).digest('hex')}`;
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.redis.set(this.key(token), userId, 'EX', SESSION_TTL_SECONDS);
    return token;
  }

  async getUserId(token: string): Promise<string | null> {
    return this.redis.get(this.key(token));
  }

  async destroy(token: string): Promise<void> {
    await this.redis.del(this.key(token));
  }
}