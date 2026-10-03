import { Injectable } from '@nestjs/common';
import type { Prisma, StatusCategory } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { serializeTask, taskListInclude } from '../tasks/tasks.service';

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** Aggregates for the home dashboard: KPIs with deltas, 7-day throughput, team load and recent activity. */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async get(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    const now = new Date();
    const today = startOfDay(now);
    const weekAgo = new Date(today.getTime() - 6 * DAY);
    const twoWeeksAgo = new Date(today.getTime() - 13 * DAY);
    const endOfToday = new Date(today.getTime() + DAY - 1);

    const base: Prisma.TaskWhereInput = { deletedAt: null, archivedAt: null, project: { workspaceId, archivedAt: null } };
    const open: Prisma.TaskWhereInput = { ...base, status: { category: { notIn: ['DONE', 'CANCELED'] } } };

    const [openCount, overdue, inProgress, createdThisWeek, createdPrevWeek, completedRecent, statusGroups, members, myFocus, upcoming, activity] =
      await Promise.all([
        this.prisma.task.count({ where: open }),
        this.prisma.task.count({ where: { ...open, dueAt: { lt: now } } }),
        this.prisma.task.count({ where: { ...base, status: { category: 'IN_PROGRESS' } } }),
        this.prisma.task.count({ where: { ...base, createdAt: { gte: weekAgo } } }),
        this.prisma.task.count({ where: { ...base, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
        this.prisma.task.findMany({
          where: { ...base, completedAt: { gte: twoWeeksAgo } },
          select: { completedAt: true, assignees: { where: { role: 'ASSIGNEE' }, select: { userId: true } } },
        }),
        this.prisma.task.groupBy({ by: ['statusId'], where: base, _count: true }),
        this.prisma.membership.findMany({
          where: { workspaceId },
          include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
          orderBy: { joinedAt: 'asc' },
        }),
        this.prisma.task.findMany({
          where: { ...open, assignees: { some: { userId, role: 'ASSIGNEE' } }, proposalState: { not: 'DECLINED' } },
          include: taskListInclude,
          orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }, { priority: 'asc' }],
          take: 6,
        }),
        this.prisma.task.findMany({
          where: { ...open, dueAt: { gte: now, lte: new Date(endOfToday.getTime() + 7 * DAY) } },
          include: taskListInclude,
          orderBy: { dueAt: 'asc' },
          take: 6,
        }),
        this.prisma.activity.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 12 }),
      ]);

    // Throughput: completions per day over the last 7 days, compared with the 7 before.
    const days = Array.from({ length: 7 }, (_, i) => new Date(weekAgo.getTime() + i * DAY));
    const completedByDay = days.map((day) => {
      const prev = new Date(day.getTime() - 7 * DAY);
      const count = completedRecent.filter((t) => startOfDay(t.completedAt!).getTime() === day.getTime()).length;
      const prevCount = completedRecent.filter((t) => startOfDay(t.completedAt!).getTime() === prev.getTime()).length;
      return { date: day.toISOString(), count, delta: pctDelta(count, prevCount) };
    });
    const doneThisWeek = completedRecent.filter((t) => t.completedAt! >= weekAgo).length;
    const donePrevWeek = completedRecent.length - doneThisWeek;

    const statuses = await this.prisma.status.findMany({ where: { id: { in: statusGroups.map((g) => g.statusId) } } });
    const byCategory: Partial<Record<StatusCategory, number>> = {};
    for (const g of statusGroups) {
      const category = statuses.find((s) => s.id === g.statusId)?.category;
      if (category) byCategory[category] = (byCategory[category] ?? 0) + g._count;
    }
    const totalTracked = Object.values(byCategory).reduce((a, b) => a + b, 0);
    const completionRate = totalTracked ? Math.round(((byCategory.DONE ?? 0) / totalTracked) * 100) : 0;

    const openByUser = await this.prisma.taskAssignee.groupBy({
      by: ['userId'],
      where: { role: 'ASSIGNEE', task: open },
      _count: true,
    });
    const team = members.map((m) => ({
      ...m.user,
      role: m.role,
      open: openByUser.find((o) => o.userId === m.userId)?._count ?? 0,
      doneThisWeek: completedRecent.filter((t) => t.completedAt! >= weekAgo && t.assignees.some((a) => a.userId === m.userId)).length,
    }));

    const actorById = new Map(members.map((m) => [m.userId, m.user]));
    const taskTitles = await this.prisma.task.findMany({
      where: { id: { in: [...new Set(activity.map((a) => a.entityId))] } },
      select: { id: true, title: true, number: true, project: { select: { key: true } } },
    });
    const taskById = new Map(taskTitles.map((t) => [t.id, t]));

    return {
      kpis: {
        open: openCount,
        overdue,
        inProgress,
        doneThisWeek,
        doneDelta: pctDelta(doneThisWeek, donePrevWeek),
        createdThisWeek,
        createdDelta: pctDelta(createdThisWeek, createdPrevWeek),
        completionRate,
      },
      completedByDay,
      byCategory,
      team,
      myFocus: myFocus.map(serializeTask),
      upcoming: upcoming.map(serializeTask),
      activity: activity.map((a) => {
        const task = taskById.get(a.entityId);
        return {
          ...a,
          actor: actorById.get(a.actorId) ?? null,
          task: task ? { id: task.id, title: task.title, key: `${task.project.key}-${task.number}` } : null,
        };
      }),
    };
  }
}

function pctDelta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}
