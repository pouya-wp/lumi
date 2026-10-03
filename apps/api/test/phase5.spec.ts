import { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { createApp, eventually, signUp } from './helpers';

describe('phase 5: docs, collaboration, chat', () => {
  let app: INestApplication;
  let a: Awaited<ReturnType<typeof signUp>>;
  let b: Awaited<ReturnType<typeof signUp>>;
  let viewer: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let base: string;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0);
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    a = await signUp(app, 'Writer');
    b = await signUp(app, 'Coauthor');
    viewer = await signUp(app, 'Reader');
    workspaceId = (await a.get('/api/workspaces')).body[0].id;
    await a.post(`/api/workspaces/${workspaceId}/invites`).send({ email: b.email }).expect(201);
    await a.post(`/api/workspaces/${workspaceId}/invites`).send({ email: viewer.email, role: 'VIEWER' }).expect(201);
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await app.close();
  });

  it('manages a page tree with templates, snapshots, versions and safe moves', async () => {
    const root = (await a.post(`/api/workspaces/${workspaceId}/docs`).send({ title: 'Handbook', icon: '📘' }).expect(201)).body;
    const child = (await a.post(`/api/workspaces/${workspaceId}/docs`).send({ parentId: root.id, template: 'meeting' }).expect(201)).body;
    expect(child.kind).toBe('MEETING');
    const full = (await a.get(`/api/docs/${child.id}`).expect(200)).body;
    expect(full.breadcrumbs.map((x: { id: string }) => x.id)).toEqual([root.id]);
    expect(JSON.stringify(full.content)).toContain('taskList');
    expect(full.canEdit).toBe(true);
    expect((await viewer.get(`/api/docs/${child.id}`)).body.canEdit).toBe(false);
    await viewer.post(`/api/workspaces/${workspaceId}/docs`).send({ title: 'nope' }).expect(403);

    await a.post(`/api/docs/${root.id}/move`).send({ parentId: child.id }).expect(400);
    await a.post(`/api/docs/${child.id}/move`).send({ parentId: null }).expect(200);

    await a.post(`/api/docs/${root.id}/snapshot`).send({ content: { type: 'doc', content: [] }, text: 'Lumi onboarding guide for Beyondex' }).expect(204);
    expect((await a.get(`/api/docs/${root.id}/versions`)).body).toHaveLength(1);
    const search = (await a.get(`/api/workspaces/${workspaceId}/search?q=onboarding`)).body;
    expect(search.docs.map((d: { id: string }) => d.id)).toContain(root.id);

    await a.delete(`/api/docs/${root.id}`).expect(204);
    const tree = (await a.get(`/api/workspaces/${workspaceId}/docs`)).body;
    expect(tree.map((d: { id: string }) => d.id)).not.toContain(root.id);
  });

  const connect = (token: string) =>
    new Promise<Socket>((resolve, reject) => {
      const s = io(`${base}/collab`, { auth: { token }, transports: ['websocket'] });
      sockets.push(s);
      s.on('connect', () => resolve(s));
      s.on('connect_error', reject);
    });
  const join = (s: Socket, docId: string) =>
    new Promise<{ state: ArrayBuffer; seed: boolean; canEdit: boolean; error?: string }>((r) => s.emit('join', { docId }, r));

  it('syncs Yjs updates between editors, seeds once, blocks viewers and persists state', async () => {
    const doc = (await a.post(`/api/workspaces/${workspaceId}/docs`).send({ title: 'Live' })).body;
    const [sa, sb, sv] = await Promise.all([connect(a.token), connect(b.token), connect(viewer.token)]);
    const ja = await join(sa, doc.id);
    const jb = await join(sb, doc.id);
    const jv = await join(sv, doc.id);
    expect([ja.seed, jb.seed, jv.seed]).toEqual([true, false, false]);
    expect(jv.canEdit).toBe(false);

    const ydocA = new Y.Doc();
    const ydocB = new Y.Doc();
    Y.applyUpdate(ydocB, new Uint8Array(jb.state));
    const received = new Promise<void>((r) =>
      sb.on('update', ({ update }: { update: ArrayBuffer }) => {
        Y.applyUpdate(ydocB, new Uint8Array(update));
        r();
      }),
    );
    ydocA.on('update', (update: Uint8Array) => sa.emit('update', { docId: doc.id, update }));
    ydocA.getText('t').insert(0, 'سلام بیاندکس');
    await received;
    expect(ydocB.getText('t').toString()).toBe('سلام بیاندکس');

    // Viewer updates are ignored.
    const rogue = new Y.Doc();
    rogue.getText('t').insert(0, 'HACK');
    sv.emit('update', { docId: doc.id, update: Y.encodeStateAsUpdate(rogue) });

    await eventually(async () => {
      const s2 = await connect(b.token);
      const j = await join(s2, doc.id);
      const fresh = new Y.Doc();
      Y.applyUpdate(fresh, new Uint8Array(j.state));
      expect(fresh.getText('t').toString()).toBe('سلام بیاندکس');
    });
  });

  it('runs channels, DMs, threads, reactions and message → task', async () => {
    const channels = (await a.get(`/api/workspaces/${workspaceId}/channels`).expect(200)).body;
    const general = channels.find((c: { kind: string }) => c.kind === 'PUBLIC');
    expect(general.name).toBe('عمومی');

    const sb = await connect(b.token);
    const rt = io(`${base}/realtime`, { auth: { token: b.token }, transports: ['websocket'] });
    sockets.push(rt);
    await new Promise((r) => rt.on('connect', () => setTimeout(r, 100)));
    const chatEvent = new Promise<{ channelId: string }>((r) => rt.once('chat', r));
    sb.close();

    const msg = (await a.post(`/api/channels/${general.id}/messages`).send({ text: 'Deploy at 5?\nPlease review the checklist', mentionIds: [b.user.id] }).expect(201)).body;
    expect((await chatEvent).channelId).toBe(general.id);
    const unread = (await b.get(`/api/workspaces/${workspaceId}/channels`)).body.find((c: { id: string }) => c.id === general.id).unread;
    expect(unread).toBe(1);
    await b.post(`/api/channels/${general.id}/messages`).send({ text: '👍 on it', parentId: msg.id }).expect(201);
    const list = (await b.get(`/api/channels/${general.id}/messages`)).body;
    expect(list).toHaveLength(1);
    expect(list[0].replyCount).toBe(1);
    expect((await b.get(`/api/messages/${msg.id}/thread`)).body.replies).toHaveLength(1);

    expect((await b.post(`/api/messages/${msg.id}/react`).send({ emoji: '🔥' })).body).toEqual({ '🔥': [b.user.id] });
    expect((await b.post(`/api/messages/${msg.id}/react`).send({ emoji: '🔥' })).body).toEqual({});

    await b.post(`/api/channels/${general.id}/read`).expect(204);
    expect((await b.get(`/api/workspaces/${workspaceId}/channels`)).body.find((c: { id: string }) => c.id === general.id).unread).toBe(0);

    const dm = (await a.post(`/api/workspaces/${workspaceId}/dm`).send({ userId: b.user.id }).expect(200)).body;
    expect((await b.post(`/api/workspaces/${workspaceId}/dm`).send({ userId: a.user.id })).body.id).toBe(dm.id);
    await a.post(`/api/channels/${dm.id}/messages`).send({ text: 'private' }).expect(201);
    await viewer.get(`/api/channels/${dm.id}/messages`).expect(404);

    const project = (await a.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Chat tasks' })).body;
    const task = (await a.post(`/api/messages/${msg.id}/to-task`).send({ projectId: project.id }).expect(201)).body;
    expect(task.title).toBe('Deploy at 5?');
    const after = (await a.get(`/api/channels/${general.id}/messages`)).body[0];
    expect(after.taskId).toBe(task.id);
  });
});
