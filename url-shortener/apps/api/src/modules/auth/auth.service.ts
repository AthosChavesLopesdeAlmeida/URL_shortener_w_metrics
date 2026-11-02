import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'argon2';
import type { RegisterInput } from '@shortener/shared';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersRepository) {}

  async register(input: RegisterInput) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictException('This email is already in use');

    const passwordHash = await hash(input.password);
    const user = await this.users.create({
      email: input.email,
      username: input.username,
      passwordHash,
    });

    return { id: user.id, email: user.email, name: user.username };
}
}