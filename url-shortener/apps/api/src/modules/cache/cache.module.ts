import { Module } from '@nestjs/common';
import { LinkCacheService } from './link-cache.service.js';

@Module({
  providers: [LinkCacheService],
  exports: [LinkCacheService],
})
export class CacheModule {}