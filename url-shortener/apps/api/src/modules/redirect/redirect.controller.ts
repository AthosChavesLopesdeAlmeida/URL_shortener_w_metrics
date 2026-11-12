import { Controller, Get, Header, Param, Redirect, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ClickPublisherService } from '../queue/click-publisher.service.js';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator.js';
import { RedirectService } from './redirect.service.js';

@Controller()
export class RedirectController {
  constructor(
    private readonly redirects: RedirectService,
    private readonly clicks: ClickPublisherService,
  ) {}

  @Get(':code')
  @RateLimit('redirect')
  @Redirect()
  @Header('Cache-Control', 'no-store')
  async go(
    @Param('code') code: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { url, source, linkId } = await this.redirects.resolve(code);
    res.setHeader('X-Cache', source);

    void this.clicks.publish({
      linkId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      referrer: req.get('referer'),
    });

    return { url, statusCode: 302 };
  }
}