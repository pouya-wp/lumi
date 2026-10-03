import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, signUp } from './helpers';

describe('auth', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(() => app.close());

  it('registers with a starter workspace and project', async () => {
    const u = await signUp(app, 'Pouya');
    const workspaces = await u.get('/api/workspaces').expect(200);
    expect(workspaces.body).toHaveLength(1);
    expect(workspaces.body[0].role).toBe('OWNER');

    const projects = await u.get(`/api/workspaces/${workspaces.body[0].id}/projects`).expect(200);
    expect(projects.body).toHaveLength(1);
    expect(projects.body[0].statuses.map((s: { category: string }) => s.category)).toEqual([
      'BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE',
    ]);
    expect(projects.body[0].counts.total).toBe(4);
  });

  it('rejects duplicate email, bad password and unauthenticated calls', async () => {
    const u = await signUp(app, 'Dup');
    const http = app.getHttpServer();
    await request(http).post('/api/auth/register').send({ name: 'Dup', email: u.email, password: 'password123' }).expect(409);
    await request(http).post('/api/auth/login').send({ email: u.email, password: 'wrong-password' }).expect(401);
    await request(http).get('/api/workspaces').expect(401);
    await request(http).post('/api/auth/register').send({ name: 'x', email: 'bad', password: '1' }).expect(400);
  });

  it('logs in, rotates refresh tokens and rejects reuse', async () => {
    const u = await signUp(app, 'Rotate');
    const http = app.getHttpServer();
    const login = await request(http).post('/api/auth/login').send({ email: u.email, password: 'password123' }).expect(200);
    const first = login.body.refreshToken;

    const refreshed = await request(http).post('/api/auth/refresh').send({ refreshToken: first }).expect(200);
    expect(refreshed.body.refreshToken).not.toBe(first);
    await request(http).post('/api/auth/refresh').send({ refreshToken: first }).expect(401);

    const me = await request(http).get('/api/auth/me').set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(200);
    expect(me.body.email).toBe(u.email);
    expect(me.body.passwordHash).toBeUndefined();
  });
});
