import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { StatsRepository } from './stats.repository.js';
import { StatsService } from './stats.service.js';
import { StatsController } from './stats.controller.js';
import { LinksModule } from '../links/links.module.js';

@Module({
    imports: [AuthModule, LinksModule],
    controllers: [StatsController],
    providers: [StatsRepository, StatsService]
})

export class StatsModule{}