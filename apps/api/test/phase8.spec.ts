import { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { fold } from '../src/integrations/ical';
import { parseCsv } from '../src/integrations/csv-import';
import { closesWork, extractKeys } from '../src/integrations/task-keys';
import { createApp, eventually, signUp } from './helpers';

interface Captured {
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/** Tiny HTTP server that records requests and answers with `reply`. */
async function recorder(reply: (req: Captured) => unknown = () => ({ ok: true })) {
  const seen: Captured[] = [];
  const server: Server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const captured = { url: req.url ?? '', headers: req.headers, body };
      seen.push(captured);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(reply(captured)));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { seen, server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

describe('phase 8: integrations', () => {
  let app: INestApplication;
  let a: Awaited<ReturnType<typeof signUp>>;
  let b: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let project: { id: string; key: string; statuses: { id: string; category: string }[] };
  const servers: Server[] = [];
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    a = await signUp(app, 'Integrator');
    b = await signUp(app, 'Teammate');
    workspaceId = (await a.get('/api/workspaces')).body[0].id;
    await a.post(`/api/workspaces/${workspaceId}/invites`).send({ email: b.email }).expect(201);
    project = (await a.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Integrations', key: 'INT' }).expect(201)).body;
  });

  afterAll(async () => {
    servers.forEach((s) => s.close());
    await app.close();
  });

  it('issues API keys that act within one workspace and can be revoked', async () => {
    const created = (await a.post(`/api/workspaces/${workspaceId}/api-keys`).send({ name: 'CI bot' }).expect(201)).body;
    expect(created.key).toMatch(/^lumi_/);
    const list = (await a.get(`/api/workspaces/${workspaceId}/api-keys`)).body;
    expect(list[0]).not.toHaveProperty('key');
    expect(list[0].prefix).toBe(created.key.slice(0, 12));

    const auth = { Authorization: `Bearer ${created.key}` };
    expect((await http().get('/api/v1/me').set(auth).expect(200)).body.workspace.id).toBe(workspaceId);
    expect((await http().get('/api/v1/projects').set(auth).expect(200)).body.map((p: { id: string }) => p.id)).toContain(project.id);
    const task = (await http().post(`/api/v1/projects/${project.id}/tasks`).set(auth).send({ title: 'From the API', priority: 'HIGH' }).expect(201)).body;
    expect(task.key).toBe('INT-1');
    await http().patch(`/api/v1/tasks/${task.id}`).set(auth).send({ title: 'Renamed via API' }).expect(200);
    await http().post(`/api/v1/tasks/${task.id}/comments`).set('X-Api-Key', created.key).send({ text: 'hello from CI' }).expect(201);

    // Another workspace's project is out of reach, and keys don't open the JWT API.
    const otherWs = (await b.get('/api/workspaces')).body.find((w: { id: string }) => w.id !== workspaceId).id;
    const otherProject = (await b.get(`/api/workspaces/${otherWs}/projects`)).body[0];
    await http().get(`/api/v1/projects/${otherProject.id}/tasks`).set(auth).expect(403);
    await http().get('/api/workspaces').set(auth).expect(401);

    await a.delete(`/api/api-keys/${created.id}`).expect(204);
    await http().get('/api/v1/me').set(auth).expect(401);
  });

  it('delivers signed webhooks for subscribed events', async () => {
    const sink = await recorder();
    servers.push(sink.server);
    const hook = (await a.post(`/api/workspaces/${workspaceId}/webhooks`).send({ url: `${sink.url}/hook`, events: ['task.created', 'task.completed'] }).expect(201)).body;
    await b.post(`/api/workspaces/${workspaceId}/webhooks`).send({ url: sink.url, events: ['task.created'] }).expect(403);

    const task = (await a.post(`/api/projects/${project.id}/tasks`).send({ title: 'Webhook me' }).expect(201)).body;
    const done = project.statuses.find((s) => s.category === 'DONE')!.id;
    await a.patch(`/api/tasks/${task.id}`).send({ statusId: done }).expect(200);

    await eventually(async () => expect(sink.seen.filter((r) => r.url === '/hook')).toHaveLength(2));
    const [created, completed] = sink.seen;
    expect(created.headers['x-lumi-event']).toBe('task.created');
    expect(completed.headers['x-lumi-event']).toBe('task.completed');
    expect(created.headers['x-lumi-signature']).toBe(`sha256=${createHmac('sha256', hook.secret).update(created.body).digest('hex')}`);
    expect(JSON.parse(completed.body).data.task.key).toBe(task.key);

    const ping = (await a.post(`/api/webhooks/${hook.id}/ping`).expect(200)).body;
    expect(ping.ok).toBe(true);
    const hooks = (await a.get(`/api/workspaces/${workspaceId}/webhooks`)).body;
    expect(hooks[0].deliveries.length).toBeGreaterThanOrEqual(3);
  });

  it('links GitHub commits and PRs to tasks by key and closes them', async () => {
    const { secret, webhookUrl } = (await a.post(`/api/workspaces/${workspaceId}/integrations/github`).expect(201)).body;
    expect(webhookUrl).toContain(`/api/integrations/github/${workspaceId}`);
    const task = (await a.post(`/api/projects/${project.id}/tasks`).send({ title: 'Fix login' }).expect(201)).body;
    const send = (event: string, payload: unknown, key = secret) => {
      const body = JSON.stringify(payload);
      return http()
        .post(`/api/integrations/github/${workspaceId}`)
        .set('Content-Type', 'application/json')
        .set('X-GitHub-Event', event)
        .set('X-Hub-Signature-256', `sha256=${createHmac('sha256', key).update(body).digest('hex')}`)
        .send(body);
    };
    await send('push', {}, 'wrong-secret').expect(401);

    await send('pull_request', { action: 'opened', pull_request: { number: 7, title: `${task.key}: new login`, html_url: 'https://github.com/x/y/pull/7', user: { login: 'matin' } } }).expect(200);
    let t = (await a.get(`/api/tasks/${task.id}`)).body;
    expect(t.status.category).toBe('REVIEW');

    await send('push', {
      ref: 'refs/heads/main',
      repository: { full_name: 'beyondex/lumi', default_branch: 'main' },
      commits: [{ id: 'abcdef1234567', message: `Fixes ${task.key}: handle expired tokens`, url: 'https://github.com/c/1', author: { name: 'Matin' } }],
    })
      .expect(200)
      .expect(({ body }) => expect(body.linked).toBe(1));
    t = (await a.get(`/api/tasks/${task.id}`)).body;
    expect(t.status.category).toBe('DONE');
    const comments = (await a.get(`/api/tasks/${task.id}/comments`)).body;
    expect(comments.map((c: { body: { text: string } }) => c.body.text).join('\n')).toContain('abcdef1');
  });

  it('runs a Telegram bot: link, create tasks from messages, forward notifications', async () => {
    const tg = await recorder((r) => (r.url.endsWith('/getMe') ? { ok: true, result: { username: 'lumi_test_bot' } } : { ok: true, result: true }));
    servers.push(tg.server);
    process.env.TELEGRAM_API_URL = tg.url;
    const connected = (await a.post(`/api/workspaces/${workspaceId}/integrations/telegram`).send({ botToken: '123456:ABCDEFGHIJKLMNOPQRSTUV', defaultProjectId: project.id }).expect(201)).body;
    expect(connected.username).toBe('lumi_test_bot');
    const secret = connected.webhookUrl.split('/').pop();

    const link = (await b.post(`/api/workspaces/${workspaceId}/integrations/telegram/link`).expect(200)).body;
    expect(link.deepLink).toBe(`https://t.me/lumi_test_bot?start=${link.code}`);
    const update = (text: string) => http().post(`/api/integrations/telegram/${workspaceId}/${secret}`).send({ message: { text, chat: { id: 4242 } } });
    await http().post(`/api/integrations/telegram/${workspaceId}/wrong`).send({}).expect(401);
    expect((await update(`/start ${link.code}`).expect(200)).body.linked).toBe(true);
    expect((await b.get(`/api/workspaces/${workspaceId}/integrations`)).body.telegram).toMatchObject({ connected: true, linked: true });

    const res = (await update('فردا گزارش هفتگی !فوری').expect(200)).body;
    const task = (await b.get(`/api/tasks/${res.taskId}`)).body;
    expect(task.title).toBe('گزارش هفتگی');
    expect(task.priority).toBe('URGENT');
    expect(task.assignees.map((x: { id: string }) => x.id)).toEqual([b.user.id]);

    tg.seen.length = 0;
    await a.post(`/api/projects/${project.id}/tasks`).send({ title: 'Review deck', assigneeIds: [b.user.id] }).expect(201);
    await eventually(async () => {
      const sent = tg.seen.filter((r) => r.url.endsWith('/sendMessage')).map((r) => JSON.parse(r.body));
      expect(sent.some((m) => m.chat_id === '4242' && m.text.includes('Review deck'))).toBe(true);
    });
    delete process.env.TELEGRAM_API_URL;
  });

  it('serves a private iCal feed of dated tasks', async () => {
    const due = new Date(Date.now() + 2 * 86_400_000).toISOString();
    await a.post(`/api/projects/${project.id}/tasks`).send({ title: 'Quarterly planning, with commas; and semicolons', dueAt: due, assigneeIds: [a.user.id] }).expect(201);
    const { url } = (await a.get(`/api/workspaces/${workspaceId}/calendar-feed`).expect(200)).body;
    const path = new URL(url).pathname;
    const ics = await http().get(path).expect(200);
    expect(ics.headers['content-type']).toContain('text/calendar');
    expect(ics.text).toContain('BEGIN:VCALENDAR');
    expect(ics.text).toContain('Quarterly planning\\, with commas\; and semicolons');
    const rotated = (await a.post(`/api/workspaces/${workspaceId}/calendar-feed/rotate`).expect(201)).body;
    expect(rotated.url).not.toBe(url);
    await http().get(path).expect(404);
  });

  it('imports tasks from CSV with header aliases, dry run first', async () => {
    const csv = [
      'Summary,Description,Priority,Due Date,Assignee,Labels,Status',
      `"Ship ""v2"", finally",Line one,Highest,2026-11-01,${b.email},backend;release,Done`,
      'Write changelog,,low,,nobody@x.io,,In Progress',
      ',missing title,,,,,',
    ].join('\n');
    const dry = (await a.post(`/api/projects/${project.id}/import`).send({ csv, dryRun: true }).expect(200)).body;
    expect(dry).toMatchObject({ created: 0, skipped: 1 });
    expect(dry.preview[0]).toMatchObject({ title: 'Ship "v2", finally', priority: 'URGENT', labelNames: ['backend', 'release'] });
    expect(dry.preview[0].assigneeIds).toEqual([b.user.id]);

    const real = (await a.post(`/api/projects/${project.id}/import`).send({ csv }).expect(200)).body;
    expect(real.created).toBe(2);
    const tasks = (await a.get(`/api/projects/${project.id}/tasks`)).body;
    const shipped = tasks.find((t: { title: string }) => t.title === 'Ship "v2", finally');
    expect(shipped.status.category).toBe('DONE');
    expect(tasks.find((t: { title: string }) => t.title === 'Write changelog').status.category).toBe('IN_PROGRESS');
  });

  it('has sound helpers', () => {
    expect(extractKeys('Fixes APP-12 and WEB-3, again APP-12')).toEqual(['APP-12', 'WEB-3']);
    expect(closesWork('closes APP-1')).toBe(true);
    expect(closesWork('WIP on APP-1')).toBe(false);
    expect(parseCsv('a;b\n"x;y";2\n')).toEqual([
      ['a', 'b'],
      ['x;y', '2'],
    ]);
    const long = `SUMMARY:${'س'.repeat(80)}`;
    expect(fold(long).split('\r\n ').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
