import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { LinksRepository } from '../links/links.repository.js';

const CODE_FORMAT = /^[0-9A-Za-z]{7}$/;

@Injectable()
export class RedirectService {
  constructor(private readonly links: LinksRepository) {}

  async resolve(code: string): Promise<string> {
    // Formato inválido nem chega ao banco (barra scans e rotas como /favicon.ico)
    if (!CODE_FORMAT.test(code)) throw new NotFoundException();

    const link = await this.links.findByShortCode(code);
    if (!link) throw new NotFoundException();

    const expired = link.expiresAt !== null && link.expiresAt.getTime() <= Date.now();
    if (link.status === 'inactive' || expired) throw new GoneException();

    return link.longUrl;
  }
}