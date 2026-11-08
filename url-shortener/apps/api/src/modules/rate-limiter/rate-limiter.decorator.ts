import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { RateLimitGuard } from './rate-limiter.guard.js'; 
import { RATE_LIMIT_KEY, type PolicyName } from './rate-limit.policies.js';

// Uso: @RateLimit('login'). Declara a política e já liga o guard
export const RateLimit = (policy: PolicyName) =>
  applyDecorators(SetMetadata(RATE_LIMIT_KEY, policy), UseGuards(RateLimitGuard));