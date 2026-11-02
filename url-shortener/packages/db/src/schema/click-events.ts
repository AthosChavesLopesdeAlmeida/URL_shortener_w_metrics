import { bigint, char, index, pgTable, primaryKey, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { links } from './links';

// Armazena os dados que serão usados pelas métricas
export const clickEvents = pgTable("click_events", {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity(),
  clickedAt: timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
  linkId: uuid('link_id').notNull().references(() => links.id, { onDelete: 'cascade' }),
  // Apenas a abreviação do país, e.g. BR, US etc.
  country: char('country', { length: 2 }),
  deviceType: varchar('device_type', { length: 20 }),
  referrer: text('referrer'),
},
  (t) => [
    // em tabela particionada, a PK precisa incluir a coluna de partição
    primaryKey({ columns: [t.id, t.clickedAt] }),
    index('click_events_link_time_idx').on(t.linkId, t.clickedAt),
  ],
);