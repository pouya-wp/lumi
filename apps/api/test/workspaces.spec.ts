import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, signUp } from './helpers';

describe('workspaces & members', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(() => app.close());

  it('adds existing users directly and pending invites on sign-up', async () => {
    const owner = await signUp(app, 'Owner');
    const existing = await signUp(app, 'Existing');
    const [ws] = (await owner.get('/api/workspaces')).body;

    const added = await owner.post(`/api/workspaces/${ws.id}/invites`).send({ email: existing.email }).expect(201);
    expect(added.body.status).toBe('added');
    const notes = await existing.get('/api/notifications').expect(200);
    expect(notes.body[0].type).toBe('workspace.joined');

    const email = `newbie${Date.now()}@lumi.test`;
    const invited = await owner.post(`/api/workspaces/${ws.id}/invites`).send({ email, role: 'GUEST' }).expect(201);
    expect(invited.body.status).toBe('invited');

    const reg = await request(app.getHttpServer()).post('/api/auth/register').send({ name: 'Newbie', email, password: 'password123' }).expect(201);
    const list = await request(app.getHttpServer()).get('/api/workspaces').set('Authorization', `Bearer ${reg.body.accessToken}`);
    // Invited users join the inviting workspace instead of getting a starter one.
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: ws.id, role: 'GUEST' });

    const detail = await owner.get(`/api/workspaces/${ws.id}`).expect(200);
    expect(detail.body.members).toHaveLength(3);
  });

  it('enforces roles', async () => {
    const owner = await signUp(app, 'Boss');
    const member = await signUp(app, 'Member');
    const outsider = await signUp(app, 'Outsider');
    const [ws] = (await owner.get('/api/workspaces')).body;
    await owner.post(`/api/workspaces/${ws.id}/invites`).send({ email: member.email }).expect(201);

    await member.post(`/api/workspaces/${ws.id}/invites`).send({ email: outsider.email }).expect(403);
    await outsider.get(`/api/workspaces/${ws.id}`).expect(404);
    await member.delete(`/api/workspaces/${ws.id}/members/${owner.user.id}`).expect(403);
    await owner.patch(`/api/workspaces/${ws.id}/members/${member.user.id}`).send({ role: 'ADMIN' }).expect(204);
    await member.post(`/api/workspaces/${ws.id}/invites`).send({ email: outsider.email }).expect(201);
  });
});
