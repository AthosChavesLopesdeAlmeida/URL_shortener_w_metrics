import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { REDIS } from '../../redis/redis.module.js';
import { RATE_LIMIT_POLICIES, type PolicyName } from './rate-limit.policies.js';
import { TOKEN_BUCKET_LUA } from './token-bucket.lua.js';

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

type RedisWithBucket = Redis & {
  tokenBucket(key: string, capacity: number, refill: number, cost: number): Promise<[number, number, number]>;
};

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(ENV) private readonly env: Env,
  ) {
    // registra o script (o ioredis usa EVALSHA e recarrega o script se necessário)
    this.redis.defineCommand('tokenBucket', { numberOfKeys: 1, lua: TOKEN_BUCKET_LUA });
  }

  async consume(policy: PolicyName, identifier: string): Promise<RateLimitResult> {
    const open: RateLimitResult = { allowed: true, remaining: 0, retryAfterSeconds: 0 };
    if (!this.env.RATE_LIMIT_ENABLED) return open;

    const { capacity, refillPerSecond } = RATE_LIMIT_POLICIES[policy];
    try {
      const [allowed, remaining, retryMs] = await (this.redis as RedisWithBucket).tokenBucket(
        `rl:${policy}:${identifier}`,
        capacity,
        refillPerSecond,
        1,
      );
      return { allowed: allowed === 1, remaining, retryAfterSeconds: Math.ceil(retryMs / 1000) };
    } catch (err) {
      // Fail-open: se o Redis falhar, o serviço continua (disponibilidade acima da proteção)
      this.logger.error(`Rate limiter indisponível, liberando a requisição: ${(err as Error).message}`);
      return open;
    }
  }
}