import { UnrecoverableError, type Job } from 'bullmq';
import { createClickEventSchema } from '@shortener/shared';
import type { BatchWriter } from '../batch-writer';
import { enrichClick } from '../enrichment/enrich';
import type { GeoLookup } from '../enrichment/geoip';

type Deps = { writer: BatchWriter; geo: GeoLookup; ownHosts: string[] };

export function createClickProcessor({ writer, geo, ownHosts }: Deps) {
  return async (job: Job): Promise<void> => {
    const parsed = createClickEventSchema.safeParse(job.data);
    if (!parsed.success) {
      throw new UnrecoverableError(`Evento inválido: ${parsed.error.message}`);
    }
    const event = parsed.data;
    const enriched = enrichClick(event, geo, ownHosts);

    // Só retorna quando o lote desta linha foi gravado (ou lança, e o BullMQ decide o retry)
    await writer.add({
      eventId: event.eventId,
      linkId: event.linkId,
      clickedAt: new Date(event.clickedAt),
      ...enriched,
    });
  };
}