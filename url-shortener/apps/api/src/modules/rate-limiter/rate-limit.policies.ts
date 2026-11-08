export type RateLimitPolicy = {
  capacity: number; // rajada máxima (tamanho do balde)
  refillPerSecond: number; // fichas devolvidas por segundo (ritmo sustentado)
  by: 'ip' | 'user';
};

const perMinute = (n: number) => n / 60;
const perHour = (n: number) => n / 3600;

export const RATE_LIMIT_POLICIES = {
  redirect: { capacity: 100, refillPerSecond: 30, by: 'ip' },
  login: { capacity: 10, refillPerSecond: perMinute(10), by: 'ip' },
  register: { capacity: 5, refillPerSecond: perHour(5), by: 'ip' },
  createLink: { capacity: 20, refillPerSecond: perMinute(20), by: 'user' },
  deleteAccount: { capacity: 5, refillPerSecond: perMinute(5), by: 'user' },
} as const satisfies Record<string, RateLimitPolicy>;

export type PolicyName = keyof typeof RATE_LIMIT_POLICIES;

export const RATE_LIMIT_KEY = 'rate-limit-policy';