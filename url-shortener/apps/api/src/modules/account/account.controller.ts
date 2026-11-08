import { Body, Controller, Delete, HttpCode, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { type DeleteAccountInput, deleteAccountSchema } from '@shortener/shared';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { SESSION_COOKIE } from '../auth/session.service.js';
import { RateLimit } from '../rate-limiter/rate-limiter.decorator.js';
import { AccountService } from './account.service.js';

@Controller('api/account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Delete()
  @RateLimit('deleteAccount')
  @HttpCode(204)
  async remove(
    @CurrentUser() userId: string,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.delete(userId, body.password);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}