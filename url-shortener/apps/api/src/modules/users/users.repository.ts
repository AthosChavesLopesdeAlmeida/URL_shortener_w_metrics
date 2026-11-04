import { Inject, Injectable } from '@nestjs/common';
import { eq, and, isNull, type Database, users } from '@shortener/db';
import { DB } from '../../database/database.module.js';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findByEmail(email: string) {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  }

  async create(data: { email: string; username: string; passwordHash: string }) {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async findById(id: string) {
    const [user] = await this.db.select().from(users).where(and(eq(users.id, id), isNull(users.deletedAt))).limit(1);
    return user ?? null;
  }
}