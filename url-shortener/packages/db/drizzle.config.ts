import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// npm run -w define o cwd como packages/db, então o .env da raiz fica dois níveis acima
config({ path: resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});