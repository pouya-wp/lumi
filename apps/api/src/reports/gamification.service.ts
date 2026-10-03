import { Injectable } from '@nestjs/common';
import type { Priority } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

export const PRIORITY_XP: Record<Priority, number> = { URGENT: 15, HIGH: 8, MEDIUM: 4, LOW: 2, NONE: 0 };

/** Total XP needed to reach `level` (level 1 starts at 0): 50, 150, 300, 500, … */
export const xpForLevel = (level: number) => 25 * (level - 1) * level;

export function levelOf(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, floor, next, progress: (xp - floor) / (next - floor) };
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Current and best run of consecutive days present in `days`; the current run may end today or yesterday. */
export function streaks(days: Set<string>, now = new Date()) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev: number | null = null;
  for (const k of sorted) {
    const t = new Date(`${k}T12:00:00`).getTime();
    run = prev !== null && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  let current = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, best };
}

interface XpEvent {
  at: Date;
  xp: number;
}

export const BADGES = [
  'first_task',
  'ten_done',
  'fifty_done',
  'hundred_done',
  'streak_3',
  'streak_7',
  'streak_30',
  'early_bird',
  'night_owl',
  'on_time_10',
  'urgent_slayer',
  'team_player',
  'deep_focus',
  'marathon',
  'writer',
  'chatty',
  'habit_hero',
] as const;
export type BadgeKey = (typeof BADGES)[number];

/**
 * XP, levels, streaks and badges derived from real work (completed tasks, focus,
 * habits, docs, chat). Badges are persisted the first time they are earned so the
 * owner gets a notification exactly once.
 */
@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async board(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    const members = await this.prisma.membership.findMany({ where: { workspaceId }, select: { user: { select: { id: true, name: true, avatarUrl: true } } } });
    const ids = members.map((m) => m.user.id);

    const [done, comments, focus, habitLogs, docs, messages, owned] = await Promise.all([
      this.prisma.task.findMany({
        where: { deletedAt: null, completedAt: { not: null }, status: { category: 'DONE' }, project: { workspaceId } },
        select: { completedAt: true, dueAt: true, priority: true, createdById: true, assignees: { where: { role: 'ASSIGNEE' }, select: { userId: true } } },
      }),
      this.prisma.comment.findMany({ where: { authorId: { in: ids }, task: { project: { workspaceId } } }, select: { authorId: true, createdAt: true } }),
      this.prisma.focusSession.findMany({ where: { userId: { in: ids }, completed: true }, select: { userId: true, plannedMin: true, startedAt: true } }),
      this.prisma.habitLog.findMany({ where: { habit: { workspaceId, userId: { in: ids } } }, select: { day: true, habit: { select: { userId: true } } } }),
      this.prisma.doc.findMany({ where: { workspaceId, archivedAt: null }, select: { createdById: true, createdAt: true } }),
      this.prisma.message.findMany({ where: { channel: { workspaceId }, deletedAt: null }, select: { authorId: true, createdAt: true } }),
      this.prisma.achievement.findMany({ where: { workspaceId } }),
    ]);

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const heatFrom = new Date(now.getTime() - 83 * DAY);
    heatFrom.setHours(0, 0, 0, 0);

    const result = members.map(({ user }) => {
      const events: XpEvent[] = [];
      const mineDone = done.filter((t) => t.assignees.some((a) => a.userId === user.id) || (!t.assignees.length && t.createdById === user.id));
      for (const t of mineDone) {
        const onTime = !!t.dueAt && t.completedAt! <= t.dueAt;
        events.push({ at: t.completedAt!, xp: 10 + PRIORITY_XP[t.priority] + (onTime ? 5 : 0) });
      }
      const myComments = comments.filter((c) => c.authorId === user.id);
      myComments.forEach((c) => events.push({ at: c.createdAt, xp: 2 }));
      const myFocus = focus.filter((f) => f.userId === user.id);
      myFocus.forEach((f) => events.push({ at: f.startedAt, xp: Math.round(f.plannedMin / 5) }));
      const myHabits = habitLogs.filter((h) => h.habit.userId === user.id);
      myHabits.forEach((h) => events.push({ at: new Date(`${h.day}T12:00:00`), xp: 3 }));
      const myDocs = docs.filter((d) => d.createdById === user.id);
      myDocs.forEach((d) => events.push({ at: d.createdAt, xp: 5 }));
      const myMessages = messages.filter((m) => m.authorId === user.id);
      myMessages.forEach((m) => events.push({ at: m.createdAt, xp: 1 }));

      const xp = events.reduce((a, e) => a + e.xp, 0);
      const weekXp = events.filter((e) => e.at >= weekAgo).reduce((a, e) => a + e.xp, 0);
      const activeDays = new Set(mineDone.map((t) => dayKey(t.completedAt!)));
      const streak = streaks(activeDays, now);

      const heat: Record<string, number> = {};
      for (const t of mineDone) if (t.completedAt! >= heatFrom) heat[dayKey(t.completedAt!)] = (heat[dayKey(t.completedAt!)] ?? 0) + 1;

      const focusMinutes = myFocus.reduce((a, f) => a + f.plannedMin, 0);
      const earned = new Set<BadgeKey>();
      const n = mineDone.length;
      if (n >= 1) earned.add('first_task');
      if (n >= 10) earned.add('ten_done');
      if (n >= 50) earned.add('fifty_done');
      if (n >= 100) earned.add('hundred_done');
      if (streak.best >= 3) earned.add('streak_3');
      if (streak.best >= 7) earned.add('streak_7');
      if (streak.best >= 30) earned.add('streak_30');
      if (mineDone.some((t) => t.completedAt!.getHours() < 8 && t.completedAt!.getHours() >= 4)) earned.add('early_bird');
      if (mineDone.some((t) => t.completedAt!.getHours() >= 23 || t.completedAt!.getHours() < 4)) earned.add('night_owl');
      if (mineDone.filter((t) => t.dueAt && t.completedAt! <= t.dueAt).length >= 10) earned.add('on_time_10');
      if (mineDone.filter((t) => t.priority === 'URGENT').length >= 5) earned.add('urgent_slayer');
      if (mineDone.filter((t) => t.createdById !== user.id).length >= 5) earned.add('team_player');
      if (focusMinutes >= 600) earned.add('deep_focus');
      if (myFocus.some((f) => f.plannedMin >= 50)) earned.add('marathon');
      if (myDocs.length >= 3) earned.add('writer');
      if (myMessages.length >= 50) earned.add('chatty');
      if (myHabits.length >= 21) earned.add('habit_hero');

      return { user, xp, weekXp, ...levelOf(xp), streak, done: n, focusMinutes, heat, earned };
    });

    // Persist newly earned badges and tell their owners once.
    const have = new Set(owned.map((a) => `${a.userId}:${a.key}`));
    for (const r of result) {
      const fresh = [...r.earned].filter((k) => !have.has(`${r.user.id}:${k}`));
      if (!fresh.length) continue;
      await this.prisma.achievement.createMany({ data: fresh.map((key) => ({ workspaceId, userId: r.user.id, key })), skipDuplicates: true });
      for (const key of fresh) await this.notifications.notify([r.user.id], 'lumi', 'badge', { workspaceId, badge: key, title: key });
    }
    const all = await this.prisma.achievement.findMany({ where: { workspaceId }, orderBy: { earnedAt: 'asc' } });

    const members_ = result
      .map(({ earned: _earned, ...r }) => ({
        ...r,
        badges: all.filter((a) => a.userId === r.user.id).map((a) => ({ key: a.key, earnedAt: a.earnedAt })),
      }))
      .sort((a, b) => b.weekXp - a.weekXp || b.xp - a.xp);
    return { members: members_, badges: BADGES };
  }
}
