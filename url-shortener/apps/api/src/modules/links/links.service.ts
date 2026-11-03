import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { LinksRepository } from './links.repository.js';
import { generateShortCode } from './short-code.js';

type LinkStatus = 'active' | 'inactive';

@Injectable()
export class LinksService {
  constructor(
    private readonly links: LinksRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(userId: string, longUrl: string) {
    this.assertAllowedUrl(longUrl);

    for (let attempt = 0; attempt < 5; attempt++) {
      const link = await this.links.create({ shortCode: generateShortCode(), longUrl, userId });
      if (link) return this.toResponse(link);
    }
    throw new InternalServerErrorException('Unable to generate a unique code');
  }

  async list(userId: string) {
    const rows = await this.links.getLinks(userId);
    return rows.map((l) => this.toResponse(l));
  }

  async setStatus(id: string, userId: string, status: LinkStatus) {
    const link = await this.links.updateStatus(id, userId, status);
    if (!link) throw new NotFoundException('Link not found');
    // Fase 3: invalidar a chave do cache aqui
    return this.toResponse(link);
  }

  async remove(id: string, userId: string) {
    const deleted = await this.links.delete(id, userId);
    if (!deleted) throw new NotFoundException('Link not found');
    // Fase 3: invalidar a chave do cache aqui
  }

  // Bloqueia links que apontam para o próprio encurtador (evita loops de redirect)
  private assertAllowedUrl(longUrl: string) {
    const target = new URL(longUrl).host.toLowerCase();
    const own = new URL(this.env.SHORT_URL_BASE).host.toLowerCase();
    if (target === own) {
      throw new BadRequestException('Impossible to shorten links of this domain');
    }
  }

  // Inclui a URL curta pronta para o front exibir/copiar
  private toResponse(link: { id: string; shortCode: string; longUrl: string; status: LinkStatus; createdAt: Date }) {
    return {
      id: link.id,
      shortCode: link.shortCode,
      shortUrl: `${this.env.SHORT_URL_BASE}/${link.shortCode}`,
      longUrl: link.longUrl,
      status: link.status,
      createdAt: link.createdAt,
    };
  }
}
