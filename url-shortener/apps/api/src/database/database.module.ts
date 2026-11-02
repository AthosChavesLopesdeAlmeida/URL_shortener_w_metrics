import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createDb } from '@shortener/db';
import { ENV } from "../config/config.module.js";
import type { Env } from "../config/env.js";

export const DB_CLIENT = Symbol('DB_CLIENT');
export const DB = Symbol('DB');

@Global()
@Module({
  providers: [
    {
      provide: DB_CLIENT,
      inject: [ENV],
      useFactory: (env: Env) => createDb(env.DATABASE_URL),
    },
    {
      provide: DB,
      inject: [DB_CLIENT],
      useFactory: (client: ReturnType<typeof createDb>) => client.db,
    },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(DB_CLIENT) private readonly client: ReturnType<typeof createDb>) {}

  async onApplicationShutdown() {
    await this.client.pool.end();
  }
}