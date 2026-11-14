import { CLICK_QUEUE_NAME } from '@shortener/shared';
import { loadEnv } from './config/env.js'
import { createGeoLookup } from './enrichment/geoip.js';

const env = loadEnv();

async function bootstrap() {
  const geo = await createGeoLookup(env.GEOIP_DB_PATH);
}

bootstrap();