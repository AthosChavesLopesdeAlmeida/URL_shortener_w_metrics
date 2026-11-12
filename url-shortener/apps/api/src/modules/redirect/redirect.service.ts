import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { LinkCacheService, type CachedLink } from '../cache/link-cache.service.js';
import { LinksRepository } from '../links/links.repository.js';

const CODE_FORMAT = /^[0-9A-Za-z]{7}$/;

type Resolved = { url: string; linkId: string; source: 'HIT' | 'MISS' };

@Injectable()
export class RedirectService {
  constructor(
    private readonly links: LinksRepository,
    private readonly cache: LinkCacheService,
  ) {}

  async resolve(code: string): Promise<Resolved> {
    if (!CODE_FORMAT.test(code)) throw new NotFoundException();

    // 1) cache. Entrada "found" sem linkId é de antes da mudança: trata como miss
    const cached = await this.cache.get(code);
    if (cached && (!cached.found || cached.linkId)) {
      return { ...this.evaluate(cached), source: 'HIT' };
    }

    // 2) miss: Postgres, e então popula o cache (inclusive o "não existe")
    const link = await this.links.findByShortCode(code);
    if (!link) {
      await this.cache.setNotFound(code);
      throw new NotFoundException();
    }
    await this.cache.setFound(code, {
      linkId: link.id,
      longUrl: link.longUrl,
      status: link.status,
      expiresAt: link.expiresAt,
    });

    return {
      ...this.evaluate({
        found: true,
        linkId: link.id,
        longUrl: link.longUrl,
        status: link.status,
        expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
      }),
      source: 'MISS',
    };
  }

  // Mesma regra para hit e miss: o estado do link é avaliado a cada requisição
  private evaluate(entry: CachedLink): { url: string; linkId: string } {
    if (!entry.found) throw new NotFoundException();
    const expired = entry.expiresAt !== null && new Date(entry.expiresAt).getTime() <= Date.now();
    if (entry.status === 'inactive' || expired) throw new GoneException();
    return { url: entry.longUrl, linkId: entry.linkId };
  }
}