import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_URL: z.string().url(),
  SHORT_URL_BASE: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
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