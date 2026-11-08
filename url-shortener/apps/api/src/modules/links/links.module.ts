import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LinksController } from './links.controller.js';
import { LinksRepository } from './links.repository.js';
import { LinksService } from './links.service.js';
import { CacheModule } from '../cache/cache.module.js';

@Module({
  imports: [AuthModule, CacheModule],
  controllers: [LinksController],
  providers: [LinksService, LinksRepository],
  exports: [LinksRepository]
})
export class LinksModule {}