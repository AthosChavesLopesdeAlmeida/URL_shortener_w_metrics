import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { createDb } from '@shortener/db';
import { CLICK_QUEUE_NAME } from '@shortener/shared';
import { BatchWriter } from './batch-writer';
import { loadEnv } from './config/env';
import { createGeoLookup } from './enrichment/geoip';
import { createClickProcessor } from './processors/click-events.processor';

async function main() {
  const env = loadEnv();
  const { db, pool } = createDb(env.DATABASE_URL);
  const geo = await createGeoLookup(env.GEOIP_DB_PATH);

  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('error', (err) => console.warn(`[worker] Redis: ${err.message}`));

  const writer = new BatchWriter(db, { size: env.BATCH_SIZE, flushMs: env.BATCH_FLUSH_MS });
  const ownHosts = env.SHORT_URL_BASE ? [new URL(env.SHORT_URL_BASE).hostname] : [];

  const worker = new Worker(CLICK_QUEUE_NAME, createClickProcessor({ writer, geo, ownHosts }), {
    connection,
    concurrency: env.WORKER_CONCURRENCY, // precisa ser >= BATCH_SIZE, senão o lote nunca enche
  });

  worker.on('error', (err) => console.warn(`[worker] ${err.message}`));
  worker.on('failed', (job, err) =>
    console.error(`[worker] job ${job?.id} failed (try ${job?.attemptsMade}): ${err.message}`),
  );

  console.log(`[worker] started. Queue: ${CLICK_QUEUE_NAME}`);

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`[worker] ${signal} received, closing...`);
    try {
      await worker.close(); // para de pegar jobs e espera os ativos (o timer descarrega o lote)
      await writer.flush(); // descarrega qualquer sobra
      await pool.end();
      await connection.quit();
      process.exit(0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});