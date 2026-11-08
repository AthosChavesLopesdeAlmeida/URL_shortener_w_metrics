import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountRepository } from './account.repository.js';
import { AccountService } from './account.service.js';
import { CacheModule } from '../cache/cache.module.js';

@Module({
  imports: [AuthModule, UsersModule, CacheModule],
  controllers: [AccountController],
  providers: [AccountService, AccountRepository],
})
export class AccountModule {}