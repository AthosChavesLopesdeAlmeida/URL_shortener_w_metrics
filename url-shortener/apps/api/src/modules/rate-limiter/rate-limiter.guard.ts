import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { RATE_LIMIT_KEY, RATE_LIMIT_POLICIES, type PolicyName } from './rate-limit.policies.js';
import { RateLimiterService } from './rate-limiter.service.js';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiterService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const name = this.reflector.getAllAndOverride<PolicyName | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!name) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { userId?: string }>();
    const res = http.getResponse<Response>();

    // `userId` só existe se o AuthGuard rodou antes (guard de classe roda antes do de método)
    const by = RATE_LIMIT_POLICIES[name].by;
    const identifier = by === 'user' && req.userId ? `user:${req.userId}` : `ip:${req.ip}`;

    const result = await this.limiter.consume(name, identifier);
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException(
        { statusCode: 429, message: 'Muitas requisições. Tente novamente em instantes' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}