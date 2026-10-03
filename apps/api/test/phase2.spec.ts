import { INestApplication } from '@nestjs/common';
import { createApp, signUp } from './helpers';

describe('phase 2: fields, recurrence, ranges, views, time', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let project: { id: string; statuses: { id: string; category: string }[] };
  const status = (c: string) => project.statuses.find((s) => s.category === c)!.id;

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, 'Planner');
    workspaceId = (await owner.get('/api/workspaces')).body[0].id;
    project = (await owner.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Planning' }).expect(201)).body;
  });

  afterAll(() => app.close());

  it('validates custom field values by type', async () => {
    const select = (await owner.post(`/api/projects/${project.id}/fields`).send({ name: 'Size', type: 'SELECT', options: ['S', 'M', 'L'] }).expect(201)).body;
    const budget = (await owner.post(`/api/projects/${project.id}/fields`).send({ name: 'Budget', type: 'MONEY' }).expect(201)).body;
    const owners = (await owner.post(`/api/projects/${project.id}/fields`).send({ name: 'QA', type: 'USER' }).expect(201)).body;
    const task = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Fielded' }).expect(201)).body;
    const m = select.options.items.find((o: { name: string }) => o.name === 'M').id;

    const updated = await owner.patch(`/api/tasks/${task.id}`).send({ customFields: { [select.id]: m, [budget.id]: 1500000, [owners.id]: owner.user.id } }).expect(200);
    expect(updated.body.customFields).toEqual({ [select.id]: m, [budget.id]: 1500000, [owners.id]: owner.user.id });

    await owner.patch(`/api/tasks/${task.id}`).send({ customFields: { [select.id]: 'nope' } }).expect(400);
    await owner.patch(`/api/tasks/${task.id}`).send({ customFields: { [budget.id]: 'cheap' } }).expect(400);
    await owner.patch(`/api/tasks/${task.id}`).send({ customFields: { unknown: 1 } }).expect(400);

    const cleared = await owner.patch(`/api/tasks/${task.id}`).send({ customFields: { [budget.id]: null } }).expect(200);
    expect(Object.keys(cleared.body.customFields)).not.toContain(budget.id);
    expect((await owner.get(`/api/projects/${project.id}/fields`)).body).toHaveLength(3);
  });

  it('spawns the next occurrence when a recurring task is completed', async () => {
    const due = new Date(2026, 9, 3, 18).toISOString();
    await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Bad rule', recurrence: 'FREQ=HOURLY' }).expect(400);
    const task = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Weekly report', dueAt: due, recurrence: 'FREQ=WEEKLY', assigneeIds: [owner.user.id] }).expect(201)).body;

    await owner.patch(`/api/tasks/${task.id}`).send({ statusId: status('DONE') }).expect(200);
    const list = (await owner.get(`/api/projects/${project.id}/tasks?q=Weekly report`)).body;
    expect(list).toHaveLength(2);
    const next = list.find((t: { id: string }) => t.id !== task.id);
    expect(new Date(next.dueAt).getDate()).toBe(10);
    expect(next.recurrence).toBe('FREQ=WEEKLY');
    expect(next.status.category).toBe('TODO');
    expect(next.assignees[0].id).toBe(owner.user.id);

    // Reopening and completing the old one again must not spawn a duplicate.
    await owner.patch(`/api/tasks/${task.id}`).send({ statusId: status('TODO') }).expect(200);
    await owner.patch(`/api/tasks/${task.id}`).send({ statusId: status('DONE') }).expect(200);
    expect((await owner.get(`/api/projects/${project.id}/tasks?q=Weekly report`)).body).toHaveLength(2);
  });

  it('returns workspace tasks scheduled in a date range', async () => {
    const d = (day: number) => new Date(2027, 0, day, 12).toISOString();
    await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'In range due', dueAt: d(10) }).expect(201);
    await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Spanning', startAt: d(1), dueAt: d(28) }).expect(201);
    await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Outside', dueAt: d(25) }).expect(201);
    const res = await owner.get(`/api/workspaces/${workspaceId}/tasks?from=${d(5)}&to=${d(15)}`).expect(200);
    expect(res.body.map((t: { title: string }) => t.title).sort()).toEqual(['In range due', 'Spanning']);
  });

  it('saves personal and shared views', async () => {
    const other = await signUp(app, 'Viewer2');
    await owner.post(`/api/workspaces/${workspaceId}/invites`).send({ email: other.email }).expect(201);
    await owner.post(`/api/projects/${project.id}/views`).send({ name: 'Mine', type: 'TABLE', config: { filters: { assigneeIds: ['me'] } } }).expect(201);
    const shared = (await owner.post(`/api/projects/${project.id}/views`).send({ name: 'Team', type: 'CALENDAR', config: {}, shared: true }).expect(201)).body;
    const seen = await other.get(`/api/projects/${project.id}/views`).expect(200);
    expect(seen.body.map((v: { name: string }) => v.name)).toEqual(['Team']);
    await other.patch(`/api/views/${shared.id}`).send({ name: 'Hijack' }).expect(403);
  });

  it('tracks time with a single running timer and builds a timesheet', async () => {
    const a = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Timed A' })).body;
    const b = (await owner.post(`/api/projects/${project.id}/tasks`).send({ title: 'Timed B' })).body;
    await owner.post(`/api/tasks/${a.id}/timer/start`).expect(201);
    await owner.post(`/api/tasks/${b.id}/timer/start`).expect(201);
    const running = await owner.get('/api/me/timer').expect(200);
    expect(running.body.taskId).toBe(b.id);
    const stopped = await owner.post('/api/me/timer/stop').expect(200);
    expect(stopped.body.minutes).toBeGreaterThanOrEqual(1);
    expect((await owner.get('/api/me/timer')).body).toEqual({});

    await owner.post(`/api/tasks/${a.id}/time`).send({ minutes: 90, note: 'Pairing' }).expect(201);
    await owner.post(`/api/tasks/${a.id}/time`).send({ minutes: 10, startedAt: new Date(Date.now() + 3600000).toISOString() }).expect(400);
    const forA = await owner.get(`/api/tasks/${a.id}/time`).expect(200);
    expect(forA.body.total).toBeGreaterThanOrEqual(91);

    const from = new Date(Date.now() - 86400000).toISOString();
    const to = new Date(Date.now() + 86400000).toISOString();
    const sheet = await owner.get(`/api/workspaces/${workspaceId}/timesheet?from=${from}&to=${to}`).expect(200);
    expect(sheet.body.totals.total).toBeGreaterThanOrEqual(92);
    expect(sheet.body.totals.byUser[owner.user.id]).toBe(sheet.body.totals.total);
  });
});
