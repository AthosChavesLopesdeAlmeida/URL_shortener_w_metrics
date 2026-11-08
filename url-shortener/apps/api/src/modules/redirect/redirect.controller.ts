import { Controller, Get, Header, Param, Redirect, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator.js'; 
import { RedirectService } from './redirect.service.js';

@Controller()
export class RedirectController {
  constructor(private readonly redirects: RedirectService) {}

  @Get(':code')
  @RateLimit('redirect')
  @Redirect()
  @Header('Cache-Control', 'no-store')
  async go(@Param('code') code: string, @Res({ passthrough: true }) res: Response) {
    const { url, source } = await this.redirects.resolve(code);
    res.setHeader('X-Cache', source);
    return { url, statusCode: 302 };
  }
}