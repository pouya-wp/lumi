import { INestApplication } from '@nestjs/common';
import { streak } from '../src/habits/habits.module';
import { createApp, signUp } from './helpers';

describe('phase 3: sprints, OKRs, habits, milestones, focus', () => {
  let app: INestApplication;
  let u: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let project: { id: string; statuses: { id: string; category: string }[] };
  const status = (c: string) => project.statuses.find((s) => s.category === c)!.id;
  const iso = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString();

  beforeAll(async () => {
    app = await createApp();
    u = await signUp(app, 'Scrum');
    workspaceId = (await u.get('/api/workspaces')).body[0].id;
    project = (await u.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Scrum Team', methodology: ['SCRUM'] })).body;
  });

  afterAll(() => app.close());

  it('runs a sprint end to end with burndown, velocity and carry-over', async () => {
    const s1 = (await u.post(`/api/projects/${project.id}/sprints`).send({ name: 'Sprint 1', startAt: iso(-3), endAt: iso(4) }).expect(201)).body;
    const s2 = (await u.post(`/api/projects/${project.id}/sprints`).send({ name: 'Sprint 2', startAt: iso(4), endAt: iso(11) }).expect(201)).body;
    await u.post(`/api/projects/${project.id}/sprints`).send({ name: 'Bad', startAt: iso(2), endAt: iso(1) }).expect(400);

    const ids: string[] = [];
    for (const [title, sp] of [['a', 3], ['b', 5], ['c', 2]] as const) {
      ids.push((await u.post(`/api/projects/${project.id}/tasks`).send({ title, storyPoints: sp })).body.id);
    }
    await u.post(`/api/projects/${project.id}/sprints/assign`).send({ taskIds: ids, sprintId: s1.id }).expect(204);
    await u.post(`/api/sprints/${s1.id}/start`).expect(200);
    await u.post(`/api/sprints/${s2.id}/start`).expect(400);
    await u.patch(`/api/tasks/${ids[0]}`).send({ statusId: status('DONE') }).expect(200);
    await u.patch(`/api/tasks/${ids[1]}`).send({ statusId: status('DONE') }).expect(200);

    const report = (await u.get(`/api/sprints/${s1.id}/report`).expect(200)).body;
    expect(report.total).toBe(10);
    const today = report.series.filter((p: { actual: number | null }) => p.actual !== null).pop();
    expect(today.actual).toBe(2);
    expect(report.series[0].ideal).toBe(10);

    const done = (await u.post(`/api/sprints/${s1.id}/complete`).send({ carryOver: 'next' }).expect(200)).body;
    expect(done).toMatchObject({ committedPoints: 10, completedPoints: 8, carriedOver: 1, carriedTo: s2.id });
    const list = (await u.get(`/api/projects/${project.id}/sprints`).expect(200)).body;
    expect(list.find((s: { id: string }) => s.id === s2.id).stats.tasks).toBe(1);
    expect((await u.get(`/api/sprints/${s2.id}/report`)).body.averageVelocity).toBe(8);

    // Tasks cannot move into a completed sprint.
    await u.patch(`/api/tasks/${ids[2]}`).send({ sprintId: s1.id }).expect(400);
  });

  it('computes OKR progress from numbers, linked tasks and check-ins', async () => {
    const goal = (await u.post(`/api/workspaces/${workspaceId}/goals`).send({ title: 'Launch Lumi', period: '1405-Q3', emoji: '🚀' }).expect(201)).body;
    const users = (await u.post(`/api/goals/${goal.id}/key-results`).send({ title: 'Active users', type: 'NUMBER', start: 0, target: 200 }).expect(201)).body;
    const ship = (await u.post(`/api/goals/${goal.id}/key-results`).send({ title: 'Ship features', type: 'TASKS' }).expect(201)).body;
    await u.post(`/api/goals/${goal.id}/key-results`).send({ title: 'No target', type: 'NUMBER' }).expect(400);

    await u.post(`/api/key-results/${users.id}/check-ins`).send({ value: 50, confidence: 8, note: 'Good start' }).expect(201);
    const t1 = (await u.post(`/api/projects/${project.id}/tasks`).send({ title: 'F1' })).body;
    const t2 = (await u.post(`/api/projects/${project.id}/tasks`).send({ title: 'F2' })).body;
    await u.put(`/api/key-results/${ship.id}/tasks`).send({ taskIds: [t1.id, t2.id] }).expect(204);
    await u.patch(`/api/tasks/${t1.id}`).send({ statusId: status('DONE') }).expect(200);

    const res = (await u.get(`/api/workspaces/${workspaceId}/goals?period=1405-Q3`).expect(200)).body;
    expect(res.periods).toContain('1405-Q3');
    const g = res.goals[0];
    const byTitle = Object.fromEntries(g.keyResults.map((k: { title: string; progress: number; status: string }) => [k.title, k]));
    expect(byTitle['Active users'].progress).toBe(25);
    expect(byTitle['Active users'].status).toBe('ON_TRACK');
    expect(byTitle['Ship features'].progress).toBe(50);
    expect(g.progress).toBe(38);
  });

  it('tracks habit streaks with day-of-week schedules', async () => {
    const h = (await u.post('/api/me/habits').send({ workspaceId, title: 'Read', emoji: '📚' }).expect(201)).body;
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    for (const o of [-3, -2, -1]) await u.post(`/api/habits/${h.id}/toggle`).send({ day: day(o) }).expect(200);
    let list = (await u.get(`/api/me/habits?workspaceId=${workspaceId}`)).body;
    expect(list[0].streak).toBe(3);
    await u.post(`/api/habits/${h.id}/toggle`).send({ day: day(0) }).expect(200);
    list = (await u.get(`/api/me/habits?workspaceId=${workspaceId}`)).body;
    expect(list[0].streak).toBe(4);
    await u.post(`/api/habits/${h.id}/toggle`).send({ day: day(-2) }).expect(200);
    list = (await u.get(`/api/me/habits?workspaceId=${workspaceId}`)).body;
    expect(list[0].streak).toBe(2);
    expect(list[0].best).toBe(2);

    // Mon/Wed habit: off days are skipped when counting.
    const wed = new Date(2026, 9, 7, 12);
    expect(streak([1, 3], new Set(['2026-10-07', '2026-10-05', '2026-09-30']), wed)).toBe(3);
  });

  it('builds a roadmap from milestones with task progress', async () => {
    const m = (await u.post(`/api/projects/${project.id}/milestones`).send({ title: 'Beta', dueAt: iso(20) }).expect(201)).body;
    const t = (await u.post(`/api/projects/${project.id}/tasks`).send({ title: 'Beta task' })).body;
    const t2 = (await u.post(`/api/projects/${project.id}/tasks`).send({ title: 'Beta task 2' })).body;
    await u.put(`/api/milestones/${m.id}/tasks`).send({ taskIds: [t.id, t2.id] }).expect(204);
    await u.patch(`/api/tasks/${t.id}`).send({ statusId: status('DONE') }).expect(200);
    const roadmap = (await u.get(`/api/workspaces/${workspaceId}/roadmap`).expect(200)).body;
    expect(roadmap[0]).toMatchObject({ title: 'Beta', total: 2, done: 1, project: { id: project.id } });
  });

  it('logs focus sessions and turns completed pomodoros into time entries', async () => {
    const t = (await u.post(`/api/projects/${project.id}/tasks`).send({ title: 'Deep work' })).body;
    const s = (await u.post('/api/me/focus').send({ taskId: t.id, minutes: 25 }).expect(201)).body;
    expect((await u.get('/api/me/focus')).body.current.id).toBe(s.id);
    await u.post(`/api/focus/${s.id}/finish`).send({ completed: true }).expect(200);
    const stats = (await u.get('/api/me/focus')).body;
    expect(stats.today.count).toBe(1);
    expect(stats.streak).toBe(1);
    expect(stats.current).toBeNull();
    const time = (await u.get(`/api/tasks/${t.id}/time`)).body;
    expect(time.entries[0].note).toContain('Pomodoro');
  });
});
