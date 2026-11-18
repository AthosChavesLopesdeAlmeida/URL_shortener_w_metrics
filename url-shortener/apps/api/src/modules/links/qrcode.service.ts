import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import QRCode from 'qrcode';
import type { QrQuery } from '@shortener/shared';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { LinksRepository } from './links.repository.js';

export type QrResult = { data: Buffer; mimeType: string; fileName: string };

// Fundo branco explícito: sobre uma página escura, um QR transparente fica ilegível
const OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 4, // zona silenciosa mínima que os leitores exigem
  color: { dark: '#000000', light: '#ffffff' },
};

@Injectable()
export class QrService {
  constructor(
    private readonly links: LinksRepository,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async generate(userId: string, id: string, query: QrQuery): Promise<QrResult> {
    // 1) posse: 404 para "não existe" e para "não é seu"
    const link = await this.links.getLink(id, userId);
    if (!link) throw new NotFoundException('Link não encontrado');

    // 2) o QR codifica o link CURTO, nunca a longUrl: desativar, expirar e contar cliques
    //    continuam funcionando mesmo com o QR já impresso
    const shortUrl = `${this.env.SHORT_URL_BASE}/${link.shortCode}`;

    // 3) gera no formato pedido
    if (query.format === 'png') {
      const data = await QRCode.toBuffer(shortUrl, { ...OPTIONS, type: 'png', width: query.size });
      return { data, mimeType: 'image/png', fileName: `${link.shortCode}.png` };
    }

    const svg = await QRCode.toString(shortUrl, { ...OPTIONS, type: 'svg' });
    return {
      data: Buffer.from(svg, 'utf-8'),
      mimeType: 'image/svg+xml',
      fileName: `${link.shortCode}.svg`,
    };
  }
}