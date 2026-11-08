import { Module } from '@nestjs/common';
import { LinksModule } from '../links/links.module.js';
import { RedirectController } from './redirect.controller.js';
import { CacheModule } from '../cache/cache.module.js';
import { RedirectService } from './redirect.service.js';

@Module({
  imports: [LinksModule, CacheModule],  
  controllers: [RedirectController],
  providers: [RedirectService],
})
export class RedirectModule {}