import { INestApplication } from '@nestjs/common';
import { levelOf, streaks, xpForLevel } from '../src/reports/gamification.service';
import { percentile } from '../src/reports/reports.service';
import { createApp, signUp } from './helpers';

describe('phase 6: reports and gamification', () => {
  let app: INestApplication;
  let a: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let projectId: string;
  let statuses: { id: string; category: string }[];

  beforeAll(async () => {
    app = await createApp();
    a = await signUp(app, 'Analyst');
    workspaceId = (await a.get('/api/workspaces')).body[0].id;
    const project = (await a.post(`/api/workspaces/${workspaceId}/projects`).send({ name: 'Metrics', key: 'MET' }).expect(201)).body;
    projectId = project.id;
    statuses = project.statuses;
  });

  afterAll(() => app.close());

  const status = (category: string) => statuses.find((s) => s.category === category)!.id;

  it('builds CFD, cycle time, per-person stats and CSV export from status history', async () => {
    const tasks = [];
    for (const title of ['Ship report, "v1"', 'Write docs', 'Fix bug']) {
      tasks.push((await a.post(`/api/projects/${projectId}/tasks`).send({ title, assigneeIds: [a.user.id], priority: 'HIGH', dueAt: new Date(Date.now() + 86400000).toISOString() }).expect(201)).body);
    }
    await a.patch(`/api/tasks/${tasks[0].id}`).send({ statusId: status('IN_PROGRESS') }).expect(200);
    await a.patch(`/api/tasks/${tasks[0].id}`).send({ statusId: status('DONE') }).expect(200);
    await a.patch(`/api/tasks/${tasks[1].id}`).send({ statusId: status('IN_PROGRESS') }).expect(200);

    const r = (await a.get(`/api/workspaces/${workspaceId}/reports?projectId=${projectId}`).expect(200)).body;
    expect(r.totals).toMatchObject({ completed: 1, created: 3, open: 2, wip: 1, onTimeRate: 1 });
    const today = r.cfd[r.cfd.length - 1];
    expect(today.DONE).toBe(1);
    expect(today.IN_PROGRESS).toBe(1);
    expect(r.cfd).toHaveLength(30);
    expect(r.throughput[r.throughput.length - 1]).toMatchObject({ created: 3, completed: 1 });
    expect(r.cycle.points).toHaveLength(1);
    expect(r.cycle.histogram.find((h: { key: string }) => h.key === 'lt1d').count).toBe(1);
    const me = r.people.find((p: { user: { id: string } }) => p.user.id === a.user.id);
    expect(me).toMatchObject({ done: 1, open: 2, inProgress: 1 });
    expect(r.aging[0].id).toBe(tasks[1].id);
    expect(r.priorities.find((p: { priority: string }) => p.priority === 'HIGH').count).toBe(2);

    const csv = await a.get(`/api/workspaces/${workspaceId}/export/tasks.csv?projectId=${projectId}`).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    const lines = csv.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"Ship report, ""v1"""');
  });

  it('awards XP, levels and badges once, with a notification', async () => {
    const g1 = (await a.get(`/api/workspaces/${workspaceId}/gamification`).expect(200)).body;
    const me = g1.members[0];
    // Our task is worth 10 base + 8 high priority + 5 on time; the starter project adds its own completed task.
    expect(me.xp).toBeGreaterThanOrEqual(23);
    expect(me.level).toBe(1);
    expect(me.weekXp).toBe(me.xp);
    expect(me.streak.current).toBe(1);
    expect(me.badges.map((b: { key: string }) => b.key)).toEqual(['first_task']);
    await a.get(`/api/workspaces/${workspaceId}/gamification`).expect(200);
    const notes = (await a.get('/api/notifications')).body.filter((n: { type: string }) => n.type === 'badge');
    expect(notes).toHaveLength(1);
  });

  it('computes levels, streaks and percentiles', () => {
    expect(xpForLevel(2)).toBe(50);
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(149)).toMatchObject({ level: 2, floor: 50, next: 150 });
    expect(levelOf(150).level).toBe(3);
    const now = new Date('2026-10-03T10:00:00');
    expect(streaks(new Set(['2026-10-01', '2026-10-02', '2026-09-20']), now)).toEqual({ current: 2, best: 2 });
    expect(streaks(new Set(['2026-09-01', '2026-09-02', '2026-09-03']), now)).toEqual({ current: 0, best: 3 });
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85)).toBe(9);
  });
});
