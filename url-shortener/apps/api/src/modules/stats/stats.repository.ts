import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, and, type Database, clickEvents, links } from '@shortener/db';
import { DB } from '../../database/database.module.js';

@Injectable()
export class StatsRepository {
    constructor(@Inject(DB) private readonly db: Database) {}

    async getStats (id: string) {
        const link_stats = await this.db
            .select()
            .from(clickEvents)
            .where(eq(clickEvents.linkId, id))
            .orderBy(desc(clickEvents.clickedAt))

        return link_stats
    }

    // Os métodos abaixo são apenas possibilidades, ou seja:
    // No futuro eles podem fazer parte da interface, como uma
    // Página que mostra apenas os países ou tipos de dispositivo

    async getCountriesStats (id: string) {
        const [link_country_stats] = await this.db
            .select()
            .from(clickEvents)
            .where(eq(clickEvents.linkId, id))
            .orderBy(desc(clickEvents.clickedAt))

        return link_country_stats.country
    }

    async getDeviceStats (id: string) {
        const [link_device_stats] = await this.db
            .select()
            .from(clickEvents)
            .where(eq(clickEvents.linkId, id))
            .orderBy(desc(clickEvents.clickedAt))

        return link_device_stats.deviceType
    }

    async getReferrerStats (id: string) {
        const [link_referrer_stats] = await this.db
            .select()
            .from(clickEvents)
            .where(eq(clickEvents.linkId, id))
            .orderBy(desc(clickEvents.clickedAt))

        return link_referrer_stats.referrer
    }
}