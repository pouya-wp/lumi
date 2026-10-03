import { Injectable } from '@nestjs/common';
import type { Priority } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const WEIGHT: Record<Priority, number> = { URGENT: 100, HIGH: 60, MEDIUM: 30, LOW: 10, NONE: 5 };
const DEFAULT_MIN = 45;
const MAX_BLOCK = 120;
const BUFFER = 10;

export interface PlanOptions {
  date: string; // YYYY-MM-DD local
  start?: string; // HH:MM
  end?: string;
  lunch?: boolean;
}

const at = (date: string, hhmm: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
};

/** Score a task for today: priority, due-date pressure, and momentum (already in progress). */
export function score(t: { priority: Priority; dueAt: Date | null; status: { category: string } }, day: Date) {
  let s = WEIGHT[t.priority];
  if (t.dueAt) {
    const days = Math.floor((t.dueAt.getTime() - day.getTime()) / 86400000);
    s += days < 0 ? 80 : days === 0 ? 60 : days === 1 ? 30 : days <= 6 ? 10 : 0;
  }
  if (t.status.category === 'IN_PROGRESS') s += 20;
  return s;
}

/** Deterministic "plan my day": fills working hours with the highest-scoring unblocked tasks. */
@Injectable()
export class PlannerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async get(userId: string, date: string) {
    const from = at(date, '00:00');
    const to = new Date(from.getTime() + 86400000);
    return this.prisma.planBlock.findMany({
      where: { userId, startAt: { gte: from, lt: to } },
      orderBy: { startAt: 'asc' },
      include: { task: { select: { id: true, title: true, priority: true, projectId: true, project: { select: { key: true, color: true, icon: true } }, number: true, completedAt: true } } },
    });
  }

  async plan(workspaceId: string, userId: string, opts: PlanOptions) {
    await this.access.membership(workspaceId, userId);
    const dayStart = at(opts.date, '00:00');
    const workStart = at(opts.date, opts.start ?? '09:00');
    const workEnd = at(opts.date, opts.end ?? '17:00');
    const now = new Date();
    let cursor = new Date(Math.max(workStart.getTime(), now.getTime()));
    cursor.setMinutes(Math.ceil(cursor.getMinutes() / 15) * 15, 0, 0);
    const lunch = opts.lunch !== false ? { from: at(opts.date, '12:30'), to: at(opts.date, '13:30') } : null;

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
        completedAt: null,
        proposalState: { not: 'DECLINED' },
        project: { workspaceId, archivedAt: null },
        assignees: { some: { userId, role: 'ASSIGNEE' } },
        status: { category: { notIn: ['DONE', 'CANCELED', 'BACKLOG'] } },
        // Skip tasks still blocked by unfinished work.
        dependents: { none: { type: 'BLOCKS', from: { completedAt: null, deletedAt: null } } },
      },
      include: { status: true },
    });
    const ranked = tasks.sort((a, b) => score(b, dayStart) - score(a, dayStart));

    const blocks: { taskId: string | null; title: string; startAt: Date; endAt: Date; kind: string }[] = [];
    for (const t of ranked) {
      if (cursor >= workEnd) break;
      if (lunch && cursor >= lunch.from && cursor < lunch.to) cursor = new Date(lunch.to);
      let minutes = Math.min(MAX_BLOCK, t.estimateMin ?? DEFAULT_MIN);
      let end = new Date(cursor.getTime() + minutes * 60000);
      if (lunch && cursor < lunch.from && end > lunch.from) {
        // Split around lunch: work until lunch, then continue after.
        blocks.push({ taskId: t.id, title: t.title, startAt: cursor, endAt: lunch.from, kind: 'task' });
        minutes -= Math.round((lunch.from.getTime() - cursor.getTime()) / 60000);
        cursor = new Date(lunch.to);
        end = new Date(cursor.getTime() + minutes * 60000);
      }
      if (end > workEnd) end = workEnd;
      if (end > cursor) blocks.push({ taskId: t.id, title: t.title, startAt: cursor, endAt: end, kind: 'task' });
      cursor = new Date(end.getTime() + BUFFER * 60000);
    }
    if (lunch) blocks.push({ taskId: null, title: 'lunch', startAt: lunch.from, endAt: lunch.to, kind: 'break' });

    await this.prisma.$transaction([
      this.prisma.planBlock.deleteMany({ where: { userId, startAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) } } }),
      this.prisma.planBlock.createMany({ data: blocks.map((b) => ({ ...b, userId })) }),
    ]);
    return this.get(userId, opts.date);
  }
}
