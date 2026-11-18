import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LinksRepository } from '../links/links.repository.js';
import { StatsRepository } from './stats.repository.js';
import { type LinkStatsResponse } from '@shortener/shared';

@Injectable()
export class StatsService {
  constructor(
    private readonly stats: StatsRepository,
    private readonly links: LinksRepository
  ) {}

  async getStats (id: string, userId: string): Promise<LinkStatsResponse>  {
    const link = await this.links.getLink(id, userId)
    if (!link) throw new NotFoundException("Link not found")

    const stats = await this.stats.getStats(id)

    return { linkId: link.id, shortCode: link.shortCode, ...stats }
  }

}