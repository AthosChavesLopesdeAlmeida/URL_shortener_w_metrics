import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, links, users, type Database } from '@shortener/db';
import { DB } from '../../database/database.module.js';

@Injectable()
export class AccountRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async softDelete(userId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx.update(links).set({ status: 'inactive' }).where(eq(links.userId, userId));

      const [row] = await tx
        .update(users)
        .set({ deletedAt: new Date() })
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .returning({ id: users.id });

      return !!row;
    });
  }
}