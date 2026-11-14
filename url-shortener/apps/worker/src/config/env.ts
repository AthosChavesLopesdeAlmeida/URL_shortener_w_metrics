import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    GEOIP_DB_PATH: z.string().min(1).default('./geoip/GeoLite2-Country.mmdb'),
    BATCH_SIZE: z.coerce.number().int().positive().default(100),
    BATCH_FLUSH_MS: z.coerce.number().int().positive().default(1000),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(100),
  })
  .refine((env) => env.WORKER_CONCURRENCY >= env.BATCH_SIZE, {
    path: ['WORKER_CONCURRENCY'],
    message: 'must be greater or equal to BATCH_SIZE. If not, the batch never gets full',
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Em desenvolvimento o .env fica na raiz do monorepo.
  // Em produção (Docker) as variáveis vêm do ambiente e este arquivo não existe.
  loadDotenv({ path: resolve(process.cwd(), '../../.env') });

  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    console.error(`Invalid environment variables:\n${problems.join('\n')}`);
    process.exit(1);
  }
  return parsed.data;
}