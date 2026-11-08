import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestApp } from './helpers/create-app.js';
import { createLink, PASSWORD, registerAndLogin } from './helpers/auth.js';

describe('Main API flow', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close(); // dispara o shutdown que fecha o pool do Postgres e o Redis
  });

  describe('authentication', () => {
    it('registers, reject repeated email and invalid data', async () => {
      const email = `reg-${Date.now()}@example.com`;
      const body = { email, username: `reg-${Date.now()}`, password: PASSWORD };

      const created = await request(app.getHttpServer()).post('/api/auth/register').send(body).expect(201);
      expect(created.body).not.toHaveProperty('passwordHash'); // A senha não pode vir no body da resposta (causaria exposição)

      await request(app.getHttpServer()).post('/api/auth/register').send(body).expect(409);
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'invalid', username: 'x', password: '123' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: `outro-${Date.now()}@example.com`, username: body.username, password: PASSWORD })
        .expect(409);
    });

    it('rejects incorrect credentials with the same response', async () => {
      const { email } = await registerAndLogin(app);
      const server = app.getHttpServer();

      await request(server).post('/api/auth/login').send({ email, password: 'errada123' }).expect(401);
      await request(server).post('/api/auth/login').send({ email: 'x@x.com', password: PASSWORD }).expect(401);
    });

    it('/me needs session and the logout invalidates it', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);

      const { agent, email } = await registerAndLogin(app);
      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.email).toBe(email);

      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
    });
  });

  describe('links', () => {
    it('needs login in all of the routes', async () => {
      const server = app.getHttpServer();
      await request(server).get('/api/links').expect(401);
      await request(server).post('/api/links').send({ longUrl: 'https://example.com' }).expect(401);
    });

    it('creates the link and returns the short URL', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);

      expect(link.shortCode).toMatch(/^[0-9A-Za-z]{7}$/);
      expect(link.shortUrl).toBe(`http://localhost:8080/${link.shortCode}`);
      expect(link.status).toBe('active');

      const list = await agent.get('/api/links').expect(200);
      expect(list.body.map((l: { id: string }) => l.id)).toContain(link.id);
    });

    it('rejects invalid URL, non-http(s) schema and the localhost domain', async () => {
      const { agent } = await registerAndLogin(app);

      await agent.post('/api/links').send({ longUrl: 'texto qualquer' }).expect(400);
      await agent.post('/api/links').send({ longUrl: 'ftp://example.com/arquivo' }).expect(400);
      await agent.post('/api/links').send({ longUrl: 'http://localhost:8080/abc1234' }).expect(400);
    });
  });

  describe('redirect', () => {
    it('returns 302 with location, without asking for login', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent, 'https://example.com/destino');

      const res = await request(app.getHttpServer()).get(`/${link.shortCode}`).expect(302);
      expect(res.headers.location).toBe('https://example.com/destino');
    });

    it('returns 404 for non-existing code and invalid format', async () => {
      const server = app.getHttpServer();
      await request(server).get('/Zz0Zz0Z').expect(404);
      await request(server).get('/abc').expect(404);
    });

    it('returns 410 after deactivation and 302 after reactivation', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);
      const server = app.getHttpServer();

      await agent.patch(`/api/links/${link.id}`).send({ status: 'inactive' }).expect(200);
      await request(server).get(`/${link.shortCode}`).expect(410);

      await agent.patch(`/api/links/${link.id}`).send({ status: 'active' }).expect(200);
      await request(server).get(`/${link.shortCode}`).expect(302);
    });

    it('returns 404 after deleting', async () => {
      const { agent } = await registerAndLogin(app);
      const link = await createLink(agent);

      await agent.delete(`/api/links/${link.id}`).expect(204);
      await request(app.getHttpServer()).get(`/${link.shortCode}`).expect(404);
    });
  });

  describe('link ownership between accounts', () => {
    it('an account can not change or delete another ones link', async () => {
      const owner = await registerAndLogin(app);
      const intruder = await registerAndLogin(app);
      const link = await createLink(owner.agent);

      await intruder.agent.patch(`/api/links/${link.id}`).send({ status: 'inactive' }).expect(404);
      await intruder.agent.delete(`/api/links/${link.id}`).expect(404);

      // o link do dono continua intacto
      await request(app.getHttpServer()).get(`/${link.shortCode}`).expect(302);

      // e não aparece na listagem do intruso
      const list = await intruder.agent.get('/api/links').expect(200);
      expect(list.body).toHaveLength(0);
    });
  }); 

  describe('deleting account', () => {
    it('needs password, deactivates the links and ends the session', async () => {
      const { agent, email } = await registerAndLogin(app);
      const link = await createLink(agent);
      const server = app.getHttpServer();

      await agent.delete('/api/account').send({ password: 'errada123' }).expect(403);
      await agent.get('/api/auth/me').expect(200); // senha errada não derruba a sessão

      await agent.delete('/api/account').send({ password: PASSWORD }).expect(204);

      await agent.get('/api/auth/me').expect(401);
      await request(server).get(`/${link.shortCode}`).expect(410);
      await request(server).post('/api/auth/login').send({ email, password: PASSWORD }).expect(401);
      await request(server)
        .post('/api/auth/register')
        .send({ email, username: `outro-${Date.now()}`, password: PASSWORD })
        .expect(409)
    });
  });
});