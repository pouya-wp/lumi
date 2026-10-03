import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { createApp, signUp } from './helpers';

describe('realtime', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/realtime`;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app.close();
  });

  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const socket = io(url, { auth: { token }, transports: ['websocket'] });
      sockets.push(socket);
      socket.on('connect', () => setTimeout(() => resolve(socket), 100));
      socket.on('connect_error', reject);
    });

  it('pushes task events to workspace members and notifications to the recipient', async () => {
    const owner = await signUp(app, 'Rt Owner');
    const mate = await signUp(app, 'Rt Mate');
    const [ws] = (await owner.get('/api/workspaces')).body;
    await owner.post(`/api/workspaces/${ws.id}/invites`).send({ email: mate.email }).expect(201);
    const [project] = (await owner.get(`/api/workspaces/${ws.id}/projects`)).body;

    const socket = await connect(mate.token);
    const taskEvent = new Promise<{ action: string }>((r) => socket.once('task', r));
    const notification = new Promise<{ type: string }>((r) => socket.once('notification', r));

    await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Live', assigneeIds: [mate.user.id] }).expect(201);

    expect((await taskEvent).action).toBe('created');
    expect((await notification).type).toBe('task.proposed');
  });

  it('disconnects sockets with an invalid token', async () => {
    const socket = io(url, { auth: { token: 'nope' }, transports: ['websocket'] });
    sockets.push(socket);
    await new Promise<void>((r) => socket.on('disconnect', () => r()));
    expect(socket.connected).toBe(false);
  });
});
