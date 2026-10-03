import { Injectable } from '@nestjs/common';
import type { Prisma, StatusCategory } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const MAX_DAYS = 180;

export interface ReportQuery {
  from?: string;
  to?: string;
  projectId?: string;
}

const startOfDay = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
};
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

/** Buckets for the cycle-time histogram, in hours. */
const CYCLE_BUCKETS = [
  { key: 'lt1d', max: 24 },
  { key: '1to2d', max: 48 },
  { key: '2to4d', max: 96 },
  { key: '4to7d', max: 168 },
  { key: '1to2w', max: 336 },
  { key: 'gt2w', max: Infinity },
];

export const entryMinutes = (e: { minutes: number | null; startedAt: Date; endedAt: Date | null }) =>
  e.minutes ?? (e.endedAt ? Math.round((e.endedAt.getTime() - e.startedAt.getTime()) / 60000) : 0);

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Workspace analytics. Status history is rebuilt from the activity log
 * (`status.changed` diffs), so CFD and cycle time need no extra tables.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async report(workspaceId: string, userId: string, q: ReportQuery) {
    await this.access.membership(workspaceId, userId);
    const to = q.to ? new Date(q.to) : new Date();
    let from = startOfDay(q.from ? new Date(q.from) : new Date(to.getTime() - 29 * DAY));
    if (to.getTime() - from.getTime() > MAX_DAYS * DAY) from = startOfDay(new Date(to.getTime() - (MAX_DAYS - 1) * DAY));

    const projectWhere: Prisma.ProjectWhereInput = { workspaceId, archivedAt: null, ...(q.projectId ? { id: q.projectId } : {}) };
    const [tasks, statuses, members, entries, focus] = await Promise.all([
      this.prisma.task.findMany({
        where: { deletedAt: null, project: projectWhere, createdAt: { lte: to } },
        select: {
          id: true,
          title: true,
          number: true,
          createdAt: true,
          completedAt: true,
          dueAt: true,
          priority: true,
          statusId: true,
          status: { select: { category: true } },
          project: { select: { id: true, key: true, name: true, icon: true, color: true } },
          assignees: { where: { role: 'ASSIGNEE' }, select: { userId: true } },
          labels: { select: { label: { select: { id: true, name: true, color: true } } } },
        },
      }),
      this.prisma.status.findMany({ where: { project: projectWhere }, select: { id: true, category: true } }),
      this.prisma.membership.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true, avatarUrl: true } } } }),
      this.prisma.timeEntry.findMany({
        where: { startedAt: { gte: from, lte: to }, task: { deletedAt: null, project: projectWhere } },
        select: { userId: true, minutes: true, startedAt: true, endedAt: true, task: { select: { projectId: true } } },
      }),
      this.prisma.focusSession.findMany({
        where: { completed: true, startedAt: { gte: from, lte: to }, user: { memberships: { some: { workspaceId } } } },
        select: { userId: true, plannedMin: true },
      }),
    ]);
    const activities = await this.prisma.activity.findMany({
      where: { workspaceId, entity: 'task', action: 'status.changed', entityId: { in: tasks.map((t) => t.id) } },
      select: { entityId: true, diff: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const categoryOf = new Map(statuses.map((s) => [s.id, s.category]));
    const changes = new Map<string, { at: Date; from: StatusCategory | undefined; to: StatusCategory | undefined }[]>();
    for (const a of activities) {
      const d = (a.diff as { statusId?: { from?: string; to?: string } } | null)?.statusId;
      if (!d) continue;
      const list = changes.get(a.entityId) ?? [];
      list.push({ at: a.createdAt, from: d.from ? categoryOf.get(d.from) : undefined, to: d.to ? categoryOf.get(d.to) : undefined });
      changes.set(a.entityId, list);
    }

    // Per-task timeline: [time, category] from creation through each status change.
    const timelines = new Map<string, { at: number; cat: StatusCategory }[]>();
    const startedAt = new Map<string, number>();
    for (const t of tasks) {
      const list = changes.get(t.id) ?? [];
      const initial = list[0]?.from ?? t.status.category;
      const tl = [{ at: t.createdAt.getTime(), cat: initial }];
      for (const c of list) if (c.to) tl.push({ at: c.at.getTime(), cat: c.to });
      timelines.set(t.id, tl);
      const start = tl.find((e) => e.cat === 'IN_PROGRESS' || e.cat === 'REVIEW');
      if (start) startedAt.set(t.id, start.at);
    }

    // Days in range.
    const days: Date[] = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY)) days.push(new Date(d));

    const cfdCats: StatusCategory[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    const cfd = days.map((d) => {
      const end = Math.min(d.getTime() + DAY - 1, to.getTime());
      const row: Record<string, number | string> = { day: dayKey(d) };
      for (const c of cfdCats) row[c] = 0;
      for (const tl of timelines.values()) {
        if (tl[0].at > end) continue;
        let cat = tl[0].cat;
        for (const e of tl) if (e.at <= end) cat = e.cat;
        if (cat in row) (row[cat] as number)++;
      }
      return row;
    });

    const inRange = (d: Date | null) => !!d && d >= from && d <= to;
    const throughput = days.map((d) => {
      const k = dayKey(d);
      return {
        day: k,
        created: tasks.filter((t) => dayKey(t.createdAt) === k).length,
        completed: tasks.filter((t) => t.completedAt && t.status.category === 'DONE' && dayKey(t.completedAt) === k).length,
      };
    });

    const done = tasks.filter((t) => t.status.category === 'DONE' && inRange(t.completedAt));
    const cycle = done.map((t) => {
      const start = startedAt.get(t.id) ?? t.createdAt.getTime();
      return {
        id: t.id,
        key: `${t.project.key}-${t.number}`,
        title: t.title,
        completedAt: t.completedAt!,
        cycleHours: Math.max(0, (t.completedAt!.getTime() - start) / HOUR),
        leadHours: Math.max(0, (t.completedAt!.getTime() - t.createdAt.getTime()) / HOUR),
      };
    });
    const cycleSorted = cycle.map((c) => c.cycleHours).sort((a, b) => a - b);
    const leadSorted = cycle.map((c) => c.leadHours).sort((a, b) => a - b);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const histogram = CYCLE_BUCKETS.map((b, i) => ({
      key: b.key,
      count: cycleSorted.filter((h) => h < b.max && (i === 0 || h >= CYCLE_BUCKETS[i - 1].max)).length,
    }));

    const withDue = done.filter((t) => t.dueAt);
    const onTime = withDue.filter((t) => t.completedAt! <= t.dueAt!).length;
    const open = tasks.filter((t) => !['DONE', 'CANCELED'].includes(t.status.category));

    const people = members.map(({ user }) => {
      const mine = (t: (typeof tasks)[number]) => t.assignees.some((a) => a.userId === user.id);
      const myDone = done.filter(mine);
      const myDue = myDone.filter((t) => t.dueAt);
      const myCycle = cycle.filter((c) => myDone.some((t) => t.id === c.id)).map((c) => c.cycleHours);
      return {
        user,
        done: myDone.length,
        open: open.filter(mine).length,
        overdue: open.filter((t) => mine(t) && t.dueAt && t.dueAt < new Date()).length,
        inProgress: open.filter((t) => mine(t) && (t.status.category === 'IN_PROGRESS' || t.status.category === 'REVIEW')).length,
        avgCycleHours: avg(myCycle),
        onTimeRate: myDue.length ? myDue.filter((t) => t.completedAt! <= t.dueAt!).length / myDue.length : null,
        minutes: entries.filter((e) => e.userId === user.id).reduce((a, e) => a + entryMinutes(e), 0),
        focusMinutes: focus.filter((f) => f.userId === user.id).reduce((a, f) => a + f.plannedMin, 0),
        daily: days.map((d) => myDone.filter((t) => dayKey(t.completedAt!) === dayKey(d)).length),
      };
    });

    const projects = new Map<string, { project: (typeof tasks)[number]['project']; minutes: number; done: number; open: number }>();
    for (const t of tasks) {
      const p = projects.get(t.project.id) ?? { project: t.project, minutes: 0, done: 0, open: 0 };
      if (done.includes(t)) p.done++;
      if (open.includes(t)) p.open++;
      projects.set(t.project.id, p);
    }
    for (const e of entries) {
      const p = projects.get(e.task.projectId);
      if (p) p.minutes += entryMinutes(e);
    }

    const priorities = (['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const).map((p) => ({ priority: p, count: open.filter((t) => t.priority === p).length }));
    const labelCounts = new Map<string, { label: { id: string; name: string; color: string }; count: number }>();
    for (const t of open)
      for (const { label } of t.labels) {
        const l = labelCounts.get(label.id) ?? { label, count: 0 };
        l.count++;
        labelCounts.set(label.id, l);
      }

    // Aging WIP: open in-progress work and how long it has been in flight.
    const aging = open
      .filter((t) => t.status.category === 'IN_PROGRESS' || t.status.category === 'REVIEW')
      .map((t) => ({
        id: t.id,
        key: `${t.project.key}-${t.number}`,
        title: t.title,
        category: t.status.category,
        ageHours: (Date.now() - (startedAt.get(t.id) ?? t.createdAt.getTime())) / HOUR,
        assigneeIds: t.assignees.map((a) => a.userId),
      }))
      .sort((a, b) => b.ageHours - a.ageHours)
      .slice(0, 12);

    return {
      range: { from, to },
      totals: {
        created: tasks.filter((t) => inRange(t.createdAt)).length,
        completed: done.length,
        open: open.length,
        wip: aging.length,
        overdue: open.filter((t) => t.dueAt && t.dueAt < new Date()).length,
        onTimeRate: withDue.length ? onTime / withDue.length : null,
        minutes: entries.reduce((a, e) => a + entryMinutes(e), 0),
        focusMinutes: focus.reduce((a, f) => a + f.plannedMin, 0),
      },
      throughput,
      cfd,
      cycle: {
        avgHours: avg(cycleSorted),
        medianHours: percentile(cycleSorted, 50),
        p85Hours: percentile(cycleSorted, 85),
        avgLeadHours: avg(leadSorted),
        histogram,
        points: cycle.map((c) => ({ ...c, completedAt: c.completedAt.toISOString() })),
      },
      people,
      projects: [...projects.values()].sort((a, b) => b.minutes - a.minutes || b.done - a.done),
      priorities,
      labels: [...labelCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      aging,
    };
  }

  /** CSV (UTF-8 with BOM so Excel shows Persian correctly) of every live task in scope. */
  async exportCsv(workspaceId: string, userId: string, projectId?: string) {
    await this.access.membership(workspaceId, userId);
    const tasks = await this.prisma.task.findMany({
      where: { deletedAt: null, project: { workspaceId, ...(projectId ? { id: projectId } : {}) } },
      include: {
        project: { select: { key: true, name: true } },
        status: { select: { name: true, category: true } },
        assignees: { where: { role: 'ASSIGNEE' }, include: { user: { select: { name: true } } } },
        labels: { include: { label: { select: { name: true } } } },
        timeEntries: { select: { minutes: true, startedAt: true, endedAt: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ projectId: 'asc' }, { number: 'asc' }],
    });
    const header = ['key', 'title', 'project', 'status', 'category', 'priority', 'assignees', 'labels', 'createdBy', 'createdAt', 'startAt', 'dueAt', 'completedAt', 'estimateMin', 'storyPoints', 'loggedMin'];
    const rows = tasks.map((t) =>
      [
        `${t.project.key}-${t.number}`,
        t.title,
        t.project.name,
        t.status.name,
        t.status.category,
        t.priority,
        t.assignees.map((a) => a.user.name).join('; '),
        t.labels.map((l) => l.label.name).join('; '),
        t.createdBy.name,
        t.createdAt,
        t.startAt,
        t.dueAt,
        t.completedAt,
        t.estimateMin,
        t.storyPoints,
        t.timeEntries.reduce((a, e) => a + entryMinutes(e), 0),
      ]
        .map(csvCell)
        .join(','),
    );
    return '﻿' + [header.join(','), ...rows].join('\r\n') + '\r\n';
  }
}
