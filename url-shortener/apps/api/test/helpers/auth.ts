import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const PASSWORD = 'senha12345';

export async function registerAndLogin(app: INestApplication) {
  const id = randomUUID();
  const email = `test-${id}@example.com`;
  const username = `user-${id.slice(0, 8)}`;
  const agent = request.agent(app.getHttpServer());

  await agent
    .post('/api/auth/register')
    .send({ email, username, password: PASSWORD })
    .expect(201);
  await agent.post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);

  return { agent, email };
}

export async function createLink(agent: ReturnType<typeof request.agent>, longUrl = 'https://example.com/pagina') {
  const res = await agent.post('/api/links').send({ longUrl }).expect(201);
  return res.body as { id: string; shortCode: string; shortUrl: string; status: string };
}