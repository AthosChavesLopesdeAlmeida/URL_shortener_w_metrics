import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { LinkStatus } from '@shortener/shared';
import { REDIS } from '../../redis/redis.module.js';
import { LINK_CACHE_TTL_SECONDS, NEGATIVE_CACHE_TTL_SECONDS, linkKey } from './cache.constants.js';

export type CachedLink =
  | { found: true; longUrl: string; status: LinkStatus; expiresAt: string | null }
  | { found: false };

@Injectable()
export class LinkCacheService {
  private readonly logger = new Logger(LinkCacheService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // Leitura e preenchimento são "melhor esforço": se o Redis falhar, o redirect cai para o Postgres
  async get(code: string): Promise<CachedLink | null> {
    try {
      const raw = await this.redis.get(linkKey(code));
      return raw ? (JSON.parse(raw) as CachedLink) : null;
    } catch (err) {
      this.logger.warn(`Error reading cache: ${(err as Error).message}`);
      return null;
    }
  }

  async setFound(
    code: string,
    link: { longUrl: string; status: LinkStatus; expiresAt: Date | null },
  ): Promise<void> {
    const value: CachedLink = {
      found: true,
      longUrl: link.longUrl,
      status: link.status,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    };
    await this.safeSet(code, value, this.ttlFor(link.expiresAt));
  }

  async setNotFound(code: string): Promise<void> {
    await this.safeSet(code, { found: false }, NEGATIVE_CACHE_TTL_SECONDS);
  }

  // Invalidação NÃO é melhor esforço: se falhar, o erro sobe. Melhor um 500 (a operação é
  // idempotente e o usuário repete) do que um link desativado que continua redirecionando.
  async invalidate(...codes: string[]): Promise<void> {
    for (let i = 0; i < codes.length; i += 500) {
      const keys = codes.slice(i, i + 500).map(linkKey);
      if (keys.length > 0) await this.redis.del(...keys);
    }
  }

  // O TTL nunca passa do expiresAt; link já expirado fica pouco tempo (o service checa a data)
  private ttlFor(expiresAt: Date | null): number {
    if (!expiresAt) return LINK_CACHE_TTL_SECONDS;
    const secondsLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
    if (secondsLeft <= 0) return NEGATIVE_CACHE_TTL_SECONDS;
    return Math.min(LINK_CACHE_TTL_SECONDS, secondsLeft);
  }

  private async safeSet(code: string, value: CachedLink, ttlSeconds: number) {
    try {
      await this.redis.set(linkKey(code), JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Error recording in cache: ${(err as Error).message}`);
    }
  }
}