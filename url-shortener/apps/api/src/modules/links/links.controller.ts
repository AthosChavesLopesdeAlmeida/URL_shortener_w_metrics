import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { type CreateLinkInput, type UpdateLinkInput, createLinkSchema, updateLinkSchema,} from '@shortener/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { LinksService } from './links.service.js';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator.js';

@Controller('api/links')
@UseGuards(AuthGuard)
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Post()
  @RateLimit('createLink')
  create(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(createLinkSchema)) body: CreateLinkInput,
  ) {
    return this.links.create(userId, body.longUrl);
  }

  @Get()
  list(@CurrentUser() userId: string) {
    return this.links.list(userId);
  }

  @Patch(':id')
  update(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLinkSchema)) body: UpdateLinkInput,
  ) {
    return this.links.setStatus(id, userId, body.status);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() userId: string, @Param('id', ParseUUIDPipe) id: string) {
    await this.links.remove(id, userId);
  }
}