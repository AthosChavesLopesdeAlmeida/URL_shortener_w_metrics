import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RedisModule } from './redis/redis.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { LinksModule } from './modules/links/links.module.js';
import { RedirectModule } from './modules/redirect/redirect.module.js';
import { AccountModule } from './modules/account/account.module.js';
import { RateLimiterModule } from './modules/rate-limiter/rate-limiter.module.js';
import { QueueModule } from './modules/queue/queue.module.js';

@Module({
  imports: [
    ConfigModule, 
    DatabaseModule, 
    UsersModule, 
    AuthModule, 
    RedisModule, 
    LinksModule, 
    RedirectModule, 
    AccountModule, 
    RateLimiterModule,
    QueueModule
  ]
})
export class AppModule {}