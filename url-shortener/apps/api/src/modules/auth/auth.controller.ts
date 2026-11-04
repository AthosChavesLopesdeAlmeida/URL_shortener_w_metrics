import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { type LoginInput, type RegisterInput, loginSchema, registerSchema } from '@shortener/shared';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { UsersRepository } from '../users/users.repository.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './session.service.js';
import { Inject } from '@nestjs/common';

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersRepository,
    @Inject(ENV) private readonly env: Env
  ) {}

  @Post('register')
  register(@Body(new ZodValidationPipe(registerSchema)) body: RegisterInput) {
    return this.auth.register(body);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.auth.login(body);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.NODE_ENV === 'production',
      maxAge: SESSION_TTL_SECONDS * 1000,
      path: '/',
    });
    return user;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[SESSION_COOKIE]);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() userId: string) {
    const user = await this.users.findById(userId);
    return user && { id: user.id, email: user.email, username: user.username };
  }
}