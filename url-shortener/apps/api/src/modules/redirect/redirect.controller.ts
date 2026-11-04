import { Controller, Get, Header, Param, Redirect } from '@nestjs/common';
import { RedirectService } from './redirect.service.js';

@Controller()
export class RedirectController {
  constructor(private readonly redirects: RedirectService) {}

  @Get(':code')
  @Redirect()
  @Header('Cache-Control', 'no-store')
  async go(@Param('code') code: string) {
    const url = await this.redirects.resolve(code);
    return { url, statusCode: 302 };
  }
}