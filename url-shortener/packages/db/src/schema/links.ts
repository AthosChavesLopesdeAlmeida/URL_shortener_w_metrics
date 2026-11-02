import { index, pgEnum, pgTable, timestamp, uuid, varchar, text } from 'drizzle-orm/pg-core';
import { users } from './users';

// Conforme descrito no planejamento, os links podem ser ativados ou desativados, a deleção não é obrigatória
export const linkStatus = pgEnum('link_status', ['active', 'inactive']);

export const links = pgTable("links", {
  id: uuid('id').primaryKey().defaultRandom(),
  shortCode: varchar('short_code', { length: 7 }).notNull().unique(),
  longUrl: text('long_url').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: linkStatus('status').notNull().default('active'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
},
  // Cria um índice em userId para agilizar consultas de links por usuário.
  (t) => [index('links_user_id_idx').on(t.userId)],
);