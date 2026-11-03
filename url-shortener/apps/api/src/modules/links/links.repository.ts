import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, and, type Database, links } from '@shortener/db';
import { DB } from '../../database/database.module.js';

type LinkStatus = 'active' | 'inactive';

@Injectable()
export class LinksRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getLinks (userId: string) {
    const all_links = await this.db.select().from(links).where(eq(links.userId, userId)).orderBy(desc(links.createdAt))
    return all_links ?? null
  }

  async getLink (id: string) {
    const [link] = await this.db.select().from(links).where(eq(links.id, id)).limit(1)
    return link ?? null
  }

  async delete (id: string,userId: string) {
    const [row] = await this.db
      .delete(links)
      .where(and(eq(links.id, id), eq(links.userId, userId)))
      .returning({ id: links.id });
    return !!row;
  }

  async updateStatus(id: string, userId: string, status: LinkStatus) {
    const [link] = await this.db
      .update(links)
      .set({ status })
      .where(and(eq(links.id, id), eq(links.userId, userId)))
      .returning();
    return link ?? null;
  }

  async create(data: { shortCode: string; longUrl: string; userId: string }) {
    try {
      const [link] = await this.db.insert(links).values(data).returning();
      return link;
    } catch (err) {
      if (isShortCodeCollision(err)) return null; // colisão: o service gera outro código
      throw err;
    }
  }
}

function isShortCodeCollision(err: unknown): boolean {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e.cause?.code ?? e.code;
  const constraint = e.cause?.constraint ?? e.constraint;
  return code === '23505' && constraint === 'links_short_code_unique';
} 