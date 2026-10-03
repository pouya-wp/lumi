import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from './helpers';

describe('GET /health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(() => app.close());

  it('returns ok without auth', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });
});
