import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { hash, verify } from 'argon2';
import type { RegisterInput, LoginInput } from '@shortener/shared';
import { UsersRepository } from '../users/users.repository.js';
import { SessionService } from './session.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionService,
  ) {}

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

  async login(input: LoginInput) {
    const user = await this.users.findByEmail(input.email);
    const valid = user && !user.deletedAt ? await verify(user.passwordHash, input.password) : false;

    // Mesma mensagem para email inexistente e senha errada (não revela quais emails existem)
    if (!user || !valid) throw new UnauthorizedException('Credenciais inválidas');

    const token = await this.sessions.create(user.id);
    return { token, user: { id: user.id, email: user.email, username: user.username } };
  }

  async logout(token: string | undefined) {
    if (token) await this.sessions.destroy(token);
  }
}