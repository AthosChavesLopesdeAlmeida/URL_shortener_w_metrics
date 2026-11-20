import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator.js';
import { StatsService } from './stats.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js'; 

@Controller('api/links')
@UseGuards(AuthGuard)
export class StatsController {
    constructor(private readonly stats: StatsService) {}

    @Get(':id/stats')
    @RateLimit('stats')
    getStats(@CurrentUser() userId: string, @Param('id', ParseUUIDPipe) id: string) {
        return this.stats.getStats(id, userId);
    }
}