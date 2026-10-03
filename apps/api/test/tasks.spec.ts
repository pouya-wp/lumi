import { INestApplication } from '@nestjs/common';
import { createApp, signUp, tick } from './helpers';

type Status = { id: string; category: string };

describe('tasks', () => {
  let app: INestApplication;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let mate: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let projectId: string;
  let statuses: Status[];
  const status = (category: string) => statuses.find((s) => s.category === category)!.id;

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, 'Lead');
    mate = await signUp(app, 'Mate');
    workspaceId = (await owner.get('/api/workspaces')).body[0].id;
    await owner.post(`/api/workspaces/${workspaceId}/invites`).send({ email: mate.email }).expect(201);
    const project = await owner.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Mobile App', methodology: ['SCRUM'] }).expect(201);
    projectId = project.body.id;
    statuses = project.body.statuses;
    expect(project.body.key).toBe('MA');
  });

  afterAll(() => app.close());

  it('creates tasks with sequential keys, labels by name, and lists them in order', async () => {
    const a = await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'First', priority: 'HIGH', labelNames: ['design', 'Design'] }).expect(201);
    const b = await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'Second' }).expect(201);
    expect(a.body.key).toBe('MA-1');
    expect(b.body.key).toBe('MA-2');
    expect(a.body.labels).toHaveLength(1);
    expect(a.body.status.category).toBe('TODO');

    const list = await owner.get(`/api/projects/${projectId}/tasks?statusId=${status('TODO')}`).expect(200);
    expect(list.body.map((t: { title: string }) => t.title)).toEqual(['First', 'Second']);
  });

  it('runs the proposal flow: propose → counter → creator accepts with new due date', async () => {
    const due = new Date(Date.now() + 2 * 86400000).toISOString();
    const counter = new Date(Date.now() + 5 * 86400000).toISOString();
    const task = await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'Write spec', assigneeIds: [mate.user.id], dueAt: due }).expect(201);
    expect(task.body.proposalState).toBe('PROPOSED');

    const inbox = await mate.get('/api/notifications?unread=true').expect(200);
    expect(inbox.body.some((n: { type: string; actor: { id: string } }) => n.type === 'task.proposed' && n.actor.id === owner.user.id)).toBe(true);

    await owner.post(`/api/tasks/${task.body.id}/proposal`).send({ action: 'decline' }).expect(403);
    await mate.post(`/api/tasks/${task.body.id}/proposal`).send({ action: 'counter' }).expect(400);
    const countered = await mate.post(`/api/tasks/${task.body.id}/proposal`).send({ action: 'counter', dueAt: counter, note: 'Busy this week' }).expect(200);
    expect(countered.body.proposalState).toBe('PROPOSED');

    const accepted = await owner.post(`/api/tasks/${task.body.id}/proposal`).send({ action: 'accept' }).expect(200);
    expect(accepted.body.proposalState).toBe('ACCEPTED');
    expect(new Date(accepted.body.dueAt).toISOString()).toBe(counter);

    const mine = await mate.get(`/api/me/tasks?workspaceId=${workspaceId}`).expect(200);
    expect(mine.body.map((t: { id: string }) => t.id)).toContain(task.body.id);
  });

  it('declined proposals leave the assignee’s list', async () => {
    const task = await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'Nope', assigneeIds: [mate.user.id] }).expect(201);
    await mate.post(`/api/tasks/${task.body.id}/proposal`).send({ action: 'decline', note: 'Not my area' }).expect(200);
    const mine = await mate.get('/api/me/tasks').expect(200);
    expect(mine.body.map((t: { id: string }) => t.id)).not.toContain(task.body.id);
    const notes = await owner.get('/api/notifications').expect(200);
    expect(notes.body[0]).toMatchObject({ type: 'task.proposal.declined' });
  });

  it('moves tasks between columns with stable ordering and tracks completion', async () => {
    const make = async (title: string) => (await owner.post(`/api/projects/${projectId}/tasks`).send({ title, statusId: status('IN_PROGRESS') })).body;
    const x = await make('x');
    const y = await make('y');
    const z = await make('z');

    // Move z between x and y.
    await owner.post(`/api/tasks/${z.id}/move`).send({ statusId: status('IN_PROGRESS'), beforeId: x.id, afterId: y.id }).expect(200);
    // Move x to the top of Done.
    const done = await owner.post(`/api/tasks/${x.id}/move`).send({ statusId: status('DONE') }).expect(200);
    expect(done.body.completedAt).not.toBeNull();

    const col = await owner.get(`/api/projects/${projectId}/tasks?statusId=${status('IN_PROGRESS')}`).expect(200);
    expect(col.body.map((t: { title: string }) => t.title)).toEqual(['z', 'y']);

    const reopened = await owner.patch(`/api/tasks/${x.id}`).send({ statusId: status('TODO') }).expect(200);
    expect(reopened.body.completedAt).toBeNull();

    await tick();
    const activity = await owner.get(`/api/tasks/${x.id}/activity`).expect(200);
    expect(activity.body.map((a: { action: string }) => a.action)).toEqual(expect.arrayContaining(['created', 'status.changed']));
  });

  it('supports subtasks, checklist, dependencies with cycle detection, and soft delete', async () => {
    const parent = (await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'Epic' }).expect(201)).body;
    const child = (await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'Child', parentId: parent.id }).expect(201)).body;
    const item = (await owner.post(`/api/tasks/${parent.id}/checklist`).send({ text: 'Step 1' }).expect(201)).body;
    await owner.patch(`/api/checklist/${item.id}`).send({ done: true }).expect(200);

    const detail = await owner.get(`/api/tasks/${parent.id}`).expect(200);
    expect(detail.body.subtasks.map((s: { id: string }) => s.id)).toEqual([child.id]);
    expect(detail.body.checklist).toEqual({ done: 1, total: 1 });

    // Top-level list excludes subtasks.
    const list = await owner.get(`/api/projects/${projectId}/tasks`).expect(200);
    expect(list.body.map((t: { id: string }) => t.id)).not.toContain(child.id);

    await owner.post(`/api/tasks/${parent.id}/dependencies`).send({ toTaskId: child.id, type: 'BLOCKS' }).expect(204);
    await owner.post(`/api/tasks/${child.id}/dependencies`).send({ toTaskId: parent.id, type: 'BLOCKS' }).expect(400);

    await owner.delete(`/api/tasks/${child.id}`).expect(204);
    await owner.get(`/api/tasks/${child.id}`).expect(404);
  });

  it('comments notify mentions and replies; search finds by title and key', async () => {
    const task = (await owner.post(`/api/projects/${projectId}/tasks`).send({ title: 'Payment gateway' }).expect(201)).body;
    const c = await mate.post(`/api/tasks/${task.id}/comments`).send({ text: 'Check this @Lead', mentionIds: [owner.user.id] }).expect(201);
    await owner.post(`/api/tasks/${task.id}/comments`).send({ text: 'On it', parentId: c.body.id }).expect(201);

    const ownerNotes = await owner.get('/api/notifications').expect(200);
    expect(ownerNotes.body[0].type).toBe('comment.mention');
    const mateNotes = await mate.get('/api/notifications').expect(200);
    expect(mateNotes.body[0].type).toBe('comment.reply');

    const count = await mate.get('/api/notifications/unread-count').expect(200);
    expect(count.body.count).toBeGreaterThan(0);
    await mate.post('/api/notifications/read-all').expect(204);
    expect((await mate.get('/api/notifications/unread-count')).body.count).toBe(0);

    const byTitle = await owner.get(`/api/workspaces/${workspaceId}/search?q=payment`).expect(200);
    expect(byTitle.body.tasks[0].id).toBe(task.id);
    const byKey = await owner.get(`/api/workspaces/${workspaceId}/search?q=${task.key.toLowerCase()}`).expect(200);
    expect(byKey.body.tasks[0].id).toBe(task.id);
  });

  it('builds the dashboard', async () => {
    const dash = await owner.get(`/api/workspaces/${workspaceId}/dashboard`).expect(200);
    expect(dash.body.completedByDay).toHaveLength(7);
    expect(dash.body.team.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining([owner.user.id, mate.user.id]));
    expect(dash.body.kpis.open).toBeGreaterThan(0);
    expect(dash.body.activity.length).toBeGreaterThan(0);
  });

  it('blocks viewers from writing', async () => {
    const viewer = await signUp(app, 'Viewer');
    await owner.post(`/api/workspaces/${workspaceId}/invites`).send({ email: viewer.email, role: 'VIEWER' }).expect(201);
    await viewer.get(`/api/projects/${projectId}/tasks`).expect(200);
    await viewer.post(`/api/projects/${projectId}/tasks`).send({ title: 'x' }).expect(403);
  });
});
