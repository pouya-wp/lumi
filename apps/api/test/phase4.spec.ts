import { INestApplication } from '@nestjs/common';
import { createApp, eventually, signUp } from './helpers';

describe('phase 4: automations, AI, planner', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let qa: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let project: { id: string; statuses: { id: string; category: string }[] };
  const status = (c: string) => project.statuses.find((s) => s.category === c)!.id;

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, 'Auto');
    qa = await signUp(app, 'QA');
    workspaceId = (await owner.get('/api/workspaces')).body[0].id;
    await owner.post(`/api/workspaces/${workspaceId}/invites`).send({ email: qa.email }).expect(201);
    project = (await owner.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Automated', settings: undefined })).body;
    await owner.patch(`/api/projects/${project.id}`).send({ proposals: false }).expect(200);
  });

  afterAll(() => app.close());

  it('runs rules on task events with conditions and logs runs', async () => {
    await owner.post(`/api/projects/${project.id}/automations`).send({ name: 'bad', trigger: { type: 'nope' }, actions: [{ type: 'comment' }] }).expect(400);
    await owner
      .post(`/api/projects/${project.id}/automations`)
      .send({ name: 'bad hook', trigger: { type: 'task.created' }, actions: [{ type: 'webhook', params: { url: 'http://insecure' } }] })
      .expect(400);

    const urgent = (
      await owner
        .post(`/api/projects/${project.id}/automations`)
        .send({
          name: 'Urgent triage',
          trigger: { type: 'task.created' },
          conditions: [{ field: 'priority', op: 'eq', value: 'URGENT' }],
          actions: [
            { type: 'assign', params: { userIds: [qa.user.id] } },
            { type: 'add_checklist', params: { items: ['Reproduce', 'Fix'] } },
            { type: 'comment', params: { text: '🚨 Triage started' } },
            { type: 'notify', params: { to: 'assignees', message: 'Urgent task assigned' } },
          ],
        })
        .expect(201)
    ).body;
    await owner
      .post(`/api/projects/${project.id}/automations`)
      .send({ name: 'Done → review subtask', trigger: { type: 'status.changed', params: { toCategory: 'DONE' } }, actions: [{ type: 'create_subtask', params: { title: 'Post-release check' } }] })
      .expect(201);

    const normal = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Normal' })).body;
    const fire = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Prod is down', priority: 'URGENT' })).body;

    const detail = await eventually(async () => {
      const d = (await owner.get(`/api/tasks/${fire.id}`)).body;
      expect(d.checklistItems).toHaveLength(2);
      return d;
    });
    expect(detail.assignees.map((a: { id: string }) => a.id)).toContain(qa.user.id);
    const comments = (await owner.get(`/api/tasks/${fire.id}/comments`)).body;
    expect(comments[0].body.text).toBe('🚨 Triage started');
    await eventually(async () => {
      const n = (await qa.get('/api/notifications')).body;
      expect(n.some((x: { type: string }) => x.type === 'automation')).toBe(true);
    });
    expect((await owner.get(`/api/tasks/${normal.id}`)).body.checklistItems).toHaveLength(0);

    await owner.patch(`/api/tasks/${fire.id}`).send({ statusId: status('DONE') }).expect(200);
    await eventually(async () => {
      const d = (await owner.get(`/api/tasks/${fire.id}`)).body;
      expect(d.subtasks.map((s: { title: string }) => s.title)).toContain('Post-release check');
    });

    const runs = (await owner.get(`/api/automations/${urgent.id}/runs`)).body;
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe('SUCCESS');

    const dry = (await owner.post(`/api/automations/${urgent.id}/test`).send({ taskId: normal.id }).expect(200)).body;
    expect(dry).toEqual({ matches: false, actions: [] });
  });

  it('stops automation loops after a bounded depth', async () => {
    const p = (await owner.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Loopy' })).body;
    const rule = (
      await owner
        .post(`/api/projects/${p.id}/automations`)
        .send({ name: 'ping', trigger: { type: 'priority.changed' }, actions: [{ type: 'set_priority', params: { priority: 'LOW' } }, { type: 'set_priority', params: { priority: 'HIGH' } }] })
        .expect(201)
    ).body;
    const t = (await owner.post(`/api/projects/${p.id}/tasks`).send({ title: 'loop' })).body;
    await owner.patch(`/api/tasks/${t.id}`).send({ priority: 'MEDIUM' }).expect(200);
    await new Promise((r) => setTimeout(r, 800));
    const runs = (await owner.get(`/api/automations/${rule.id}/runs`)).body;
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.length).toBeLessThanOrEqual(8);
  });

  it('parses tasks, breaks them down and builds standups with the AI provider', async () => {
    expect((await owner.get('/api/ai/status')).body.enabled).toBe(true);
    const parsed = (await owner.post(`/api/workspaces/${workspaceId}/ai/parse`).send({ text: 'فردا گزارش فروش رو آماده کن' }).expect(200)).body;
    expect(parsed).toMatchObject({ title: 'گزارش فروش', priority: 'HIGH', labelNames: ['فروش'], source: 'ai' });
    expect(new Date(parsed.dueAt).getHours()).toBe(10);

    const t = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Launch page', assigneeIds: [owner.user.id] })).body;
    const preview = (await owner.post(`/api/tasks/${t.id}/ai/breakdown`).send({}).expect(200)).body;
    expect(preview.subtasks).toHaveLength(3);
    await owner.post(`/api/tasks/${t.id}/ai/breakdown`).send({ apply: true }).expect(200);
    const detail = (await owner.get(`/api/tasks/${t.id}`)).body;
    expect(detail.subtasks.map((s: { title: string }) => s.title)).toEqual(['Research', 'Implement', 'Review']);

    const chat = (await owner.post(`/api/workspaces/${workspaceId}/ai/chat`).send({ messages: [{ role: 'user', content: 'What is overdue?' }] }).expect(200)).body;
    expect(chat.reply).toContain('MOCK');
    const standup = (await owner.post(`/api/workspaces/${workspaceId}/ai/standup`).expect(200)).body;
    expect(standup.source).toBe('ai');
  });

  it('plans the day around priorities, lunch and blockers', async () => {
    const p = (await owner.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Plan' })).body;
    const mk = async (title: string, extra: object) => (await owner.post(`/api/projects/${p.id}/tasks`).send({ title, assigneeIds: [owner.user.id], ...extra })).body;
    const low = await mk('low', { priority: 'LOW', estimateMin: 30 });
    const urgent = await mk('urgent', { priority: 'URGENT', estimateMin: 60 });
    const blocked = await mk('blocked', { priority: 'URGENT', estimateMin: 30 });
    await owner.post(`/api/tasks/${low.id}/dependencies`).send({ toTaskId: blocked.id, type: 'BLOCKS' }).expect(204);

    const d = new Date(Date.now() + 86400000);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const blocks = (await owner.post('/api/me/plan').send({ workspaceId, date }).expect(200)).body as { taskId: string | null; title: string; startAt: string; endAt: string; kind: string }[];
    const taskBlocks = blocks.filter((b) => b.kind === 'task');
    const planned = taskBlocks.map((b) => b.taskId);
    expect(planned).not.toContain(blocked.id);
    expect(taskBlocks.find((b) => b.taskId === urgent.id)!.startAt < taskBlocks.find((b) => b.taskId === low.id)!.startAt).toBe(true);
    expect(new Date(taskBlocks[0].startAt).getHours()).toBe(9);
    expect(blocks.some((b) => b.kind === 'break')).toBe(true);
    // No overlaps.
    const sorted = [...blocks].sort((a, b) => a.startAt.localeCompare(b.startAt));
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].startAt >= sorted[i - 1].endAt).toBe(true);
    expect((await owner.get(`/api/me/plan?date=${date}`)).body).toHaveLength(blocks.length);
  });
});
