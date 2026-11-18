import { Inject, Injectable } from '@nestjs/common';
import type { LinkStatsResponse } from '@shortener/shared';
import { clickEvents, desc, eq, sql, type Database } from '@shortener/db';
import { DB } from '../../database/database.module.js';

type Stats = Omit<LinkStatsResponse, 'linkId' | 'shortCode'>;

const TOP = 20; // país e origem: só os mais frequentes

@Injectable()
export class StatsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getStats(linkId: string): Promise<Stats> {
    const where = eq(clickEvents.linkId, linkId);

    // ::int converte o bigint do count(*), que o driver devolveria como string
    const clicks = sql<number>`count(*)::int`;

    // Agrupa por dia em UTC (decisão: UTC, documente no README)
    const day = sql<string>`to_char(date_trunc('day', ${clickEvents.clickedAt} at time zone 'UTC'), 'YYYY-MM-DD')`;

    const [totals, clicksByDay, byCountry, byDevice, byReferrer] = await Promise.all([
      this.db.select({ total: clicks }).from(clickEvents).where(where),

      this.db.select({ day, clicks }).from(clickEvents).where(where).groupBy(day).orderBy(day),

      this.db
        .select({ country: clickEvents.country, clicks })
        .from(clickEvents)
        .where(where)
        .groupBy(clickEvents.country)
        .orderBy(desc(clicks))
        .limit(TOP),

      this.db
        .select({ deviceType: clickEvents.deviceType, clicks })
        .from(clickEvents)
        .where(where)
        .groupBy(clickEvents.deviceType)
        .orderBy(desc(clicks)),

      this.db
        .select({ referrer: clickEvents.referrer, clicks })
        .from(clickEvents)
        .where(where)
        .groupBy(clickEvents.referrer)
        .orderBy(desc(clicks))
        .limit(TOP),
    ]);

    return {
      totalClicks: totals[0]?.total ?? 0,
      clicksByDay,
      byCountry,
      byDevice,
      byReferrer,
    };
  }
}