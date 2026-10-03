import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

export async function createApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = setupApp(moduleRef.createNestApplication({ rawBody: true }));
  await app.init();
  return app;
}

let seq = 0;

/** Registers a fresh user and returns an authenticated request helper. */
export async function signUp(app: INestApplication, name = 'User', extra: Record<string, unknown> = {}) {
  const email = `${name.toLowerCase().replace(/\W/g, '')}${Date.now()}${seq++}@lumi.test`;
  const res = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ name, email, password: 'password123', ...extra })
    .expect(201);
  const token = res.body.accessToken as string;
  const http = app.getHttpServer();
  const authed = {
    get: (url: string) => request(http).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(http).post(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(http).patch(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(http).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(http).delete(url).set('Authorization', `Bearer ${token}`),
  };
  return { user: res.body.user as { id: string; email: string }, email, token, refreshToken: res.body.refreshToken as string, ...authed };
}

export const tick = () => new Promise((r) => setTimeout(r, 50));

/** Polls until the check passes (for async event listeners). */
export async function eventually<T>(check: () => Promise<T>, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  let last: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      return await check();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  throw last;
}
