import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/create-app.js';
import { createLink, registerAndLogin } from './helpers/auth.js';

describe('Cache and rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'true'; // o setup desliga; aqui queremos testar o limite
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.RATE_LIMIT_ENABLED = 'false';
    await app.close();
  });

  const fakeIp = () => `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

  describe('redirect cache', () => {
    it('first access is a MISS, the second one is a HIT', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);
      const ip = fakeIp();
      const get = () => request(app.getHttpServer()).get(`/${link.shortCode}`).set('X-Forwarded-For', ip);

      const first = await get().expect(302);
      const second = await get().expect(302);

      expect(first.headers['x-cache']).toBe('MISS');
      expect(second.headers['x-cache']).toBe('HIT');
    });

    it('the key has a TTL', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);
      await request(app.getHttpServer()).get(`/${link.shortCode}`).set('X-Forwarded-For', fakeIp()).expect(302);

      const redis = app.get<Redis>('REDIS');
      const ttl = await redis.ttl(`link:${link.shortCode}`);
      expect(ttl).toBeGreaterThan(0);
    });

    it('deactivation reflects right on, even with cached link', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);
      const ip = fakeIp();
      const get = () => request(app.getHttpServer()).get(`/${link.shortCode}`).set('X-Forwarded-For', ip);

      await get().expect(302); // popula o cache
      await agent.patch(`/api/links/${link.id}`).send({ status: 'inactive' }).expect(200);
      await get().expect(410);

      await agent.patch(`/api/links/${link.id}`).send({ status: 'active' }).expect(200);
      await get().expect(302);
    });

    it('deleting the link reflects right on', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);
      const ip = fakeIp();
      const get = () => request(app.getHttpServer()).get(`/${link.shortCode}`).set('X-Forwarded-For', ip);

      await get().expect(302);
      await agent.delete(`/api/links/${link.id}`).expect(204);
      await get().expect(404);
    });

    it('deleting the account invalidates the cached links', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);
      const ip = fakeIp();
      const get = () => request(app.getHttpServer()).get(`/${link.shortCode}`).set('X-Forwarded-For', ip);

      await get().expect(302);
      await agent.delete('/api/account').send({ password: 'senha12345' }).expect(204);
      await get().expect(410);
    });

    it('404 is also checked (negative cache)', async () => {
      const ip = fakeIp();
      const get = () => request(app.getHttpServer()).get('/Nn0Nn0N').set('X-Forwarded-For', ip);
      await get().expect(404);

      const redis = app.get<Redis>('REDIS');
      expect(await redis.ttl('link:Nn0Nn0N')).toBeGreaterThan(0);
      await get().expect(404);
    });
  });

  describe('rate limit', () => {
    it('block login after a burst and respond with 429 and a Retry-After header', async () => {
      const ip = fakeIp();
      const attempt = () =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email: `x-${randomUUID()}@example.com`, password: 'qualquer123' });

      for (let i = 0; i < 10; i++) await attempt().expect(401); // capacidade da política `login`

      const blocked = await attempt().expect(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('The limit is per IP; a different IP is not affected.', async () => {
      const blockedIp = fakeIp();
      const attempt = (ip: string) =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ email: 'nao@existe.com', password: 'qualquer123' });

      for (let i = 0; i < 11; i++) await attempt(blockedIp);
      await attempt(blockedIp).expect(429);
      await attempt(fakeIp()).expect(401);
    });

    it('the link creation limit is per user', async () => {
      const { agent } = await registerAndLogin(app);
      for (let i = 0; i < 20; i++) await agent.post('/api/links').send({ longUrl: 'https://example.com/x' }).expect(201);
      await agent.post('/api/links').send({ longUrl: 'https://example.com/x' }).expect(429);
    });
  });
});