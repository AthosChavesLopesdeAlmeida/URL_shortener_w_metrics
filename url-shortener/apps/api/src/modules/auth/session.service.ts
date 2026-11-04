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

  private userKey(userId: string) {
    return `user_sessions:${userId}`;
  }

  async create(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const key = this.key(token);

    await this.redis
      .multi()
      .set(key, userId, 'EX', SESSION_TTL_SECONDS)
      .sadd(this.userKey(userId), key)
      .expire(this.userKey(userId), SESSION_TTL_SECONDS) // todo o cache/sessão com TTL (decisão 001)
      .exec();
    return token;
  }

  async getUserId(token: string): Promise<string | null> {
    return this.redis.get(this.key(token));
  }

  async destroy(token: string): Promise<void> {
    const key = this.key(token);
    const userId = await this.redis.get(key);
    const tx = this.redis.multi().del(key);
    if (userId) tx.srem(this.userKey(userId), key);
    await tx.exec();
  }

  async destroyAllForUser(userId: string): Promise<void> {
    const keys = await this.redis.smembers(this.userKey(userId));
    await this.redis.del(...keys, this.userKey(userId));
  }
}