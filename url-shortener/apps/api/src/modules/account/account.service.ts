import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify } from 'argon2';
import { SessionService } from '../auth/session.service.js';
import { UsersRepository } from '../users/users.repository.js';
import { AccountRepository } from './account.repository.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersRepository,
    private readonly account: AccountRepository,
    private readonly sessions: SessionService,
  ) {}

  async delete(userId: string, password: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();

    const valid = await verify(user.passwordHash, password);
    if (!valid) throw new ForbiddenException('Wrong password');

    await this.account.softDelete(userId);
    await this.sessions.destroyAllForUser(userId);
  }
}