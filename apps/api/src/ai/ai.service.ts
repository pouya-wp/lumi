import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { parseQuickAdd, toJalali, JALALI_MONTHS } from '@lumi/shared';
import type { Priority } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { AI_PROVIDER, type AiProvider, type ChatMessage } from './ai.provider';

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'];

export interface ParsedTask {
  title: string;
  description?: string;
  dueAt?: string;
  priority?: Priority;
  assigneeIds: string[];
  labelNames: string[];
  subtasks: string[];
  source: 'ai' | 'rules';
}

/** Simple sliding-window limiter so one user cannot burn the AI budget. */
class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}
  check(key: string) {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) throw new HttpException('Too many AI requests, try again in a minute', HttpStatus.TOO_MANY_REQUESTS);
    recent.push(now);
    this.hits.set(key, recent);
  }
}

function persianDate(d: Date) {
  const j = toJalali(d);
  return `${j.jd} ${JALALI_MONTHS[j.jm - 1]} ${j.jy}`;
}

function extractJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = /\{[\s\S]*\}/.exec(text);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AiService {
  private readonly limiter = new RateLimiter(30, 60_000);

  constructor(
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly tasks: TasksService,
  ) {}

  status() {
    return { enabled: this.ai.enabled, model: this.ai.enabled ? this.ai.model : null };
  }

  private async locale(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true, name: true } });
    return u;
  }

  private systemPrompt(locale: string) {
    const now = new Date();
    return [
      'You are Lumi, the AI assistant inside the Lumi task manager built by team Beyondex.',
      `Today is ${now.toDateString()} (Jalali: ${persianDate(now)}). Work week in Iran is Saturday–Wednesday; Friday is the weekend.`,
      locale === 'fa' ? 'Answer in fluent, friendly Persian (Farsi). Use Persian digits.' : 'Answer in concise English.',
      'Be practical and brief. Never invent tasks, people or numbers that are not in the provided context.',
    ].join('\n');
  }

  /** Natural-language task → structured fields. Falls back to the rule-based parser when AI is off. */
  async parseTask(workspaceId: string, userId: string, text: string): Promise<ParsedTask> {
    await this.access.membership(workspaceId, userId);
    const members = await this.prisma.membership.findMany({ where: { workspaceId }, include: { user: { select: { id: true, name: true, email: true } } } });
    const match = (name: string) =>
      members.find((m) => m.user.name.toLowerCase().includes(name.toLowerCase()) || m.user.email.toLowerCase().startsWith(name.toLowerCase()))?.user.id;

    if (!this.ai.enabled) {
      const r = parseQuickAdd(text);
      return {
        title: r.title || text,
        dueAt: r.dueAt?.toISOString(),
        priority: r.priority,
        assigneeIds: r.mentions.map(match).filter((x): x is string => !!x),
        labelNames: r.labels,
        subtasks: [],
        source: 'rules',
      };
    }

    this.limiter.check(userId);
    const { locale } = await this.locale(userId);
    const raw = await this.ai.complete(
      [
        { role: 'system', content: this.systemPrompt(locale) },
        {
          role: 'user',
          content: [
            'TASK_PARSE. Extract a task from the text below. Reply with JSON only:',
            '{"title": string (short, imperative, same language as input), "description": string|null, "priority": "URGENT"|"HIGH"|"MEDIUM"|"LOW"|null,',
            ' "dueInDays": number|null (0=today, 1=tomorrow…), "dueTime": "HH:MM"|null, "assigneeNames": string[], "labels": string[], "subtasks": string[] (0-6 concrete steps)}',
            `Team members: ${members.map((m) => m.user.name).join(', ')}`,
            `Text: """${text}"""`,
          ].join('\n'),
        },
      ],
      { json: true, temperature: 0.1 },
    );
    const data = extractJson<{
      title?: string;
      description?: string | null;
      priority?: string | null;
      dueInDays?: number | null;
      dueTime?: string | null;
      assigneeNames?: string[];
      labels?: string[];
      subtasks?: string[];
    }>(raw);
    if (!data?.title) return { ...(await this.parseTaskWithRules(text, match)), source: 'rules' };

    let dueAt: string | undefined;
    if (typeof data.dueInDays === 'number' || data.dueTime) {
      const d = new Date();
      d.setDate(d.getDate() + (data.dueInDays ?? 0));
      const [h, m] = (data.dueTime ?? '18:00').split(':').map(Number);
      d.setHours(Number.isFinite(h) ? h : 18, Number.isFinite(m) ? m : 0, 0, 0);
      dueAt = d.toISOString();
    }
    return {
      title: data.title.slice(0, 300),
      description: data.description ?? undefined,
      dueAt,
      priority: data.priority && PRIORITIES.includes(data.priority) ? (data.priority as Priority) : undefined,
      assigneeIds: (data.assigneeNames ?? []).map(match).filter((x): x is string => !!x),
      labelNames: (data.labels ?? []).slice(0, 5),
      subtasks: (data.subtasks ?? []).slice(0, 6),
      source: 'ai',
    };
  }

  private async parseTaskWithRules(text: string, match: (n: string) => string | undefined) {
    const r = parseQuickAdd(text);
    return { title: r.title || text, dueAt: r.dueAt?.toISOString(), priority: r.priority, assigneeIds: r.mentions.map(match).filter((x): x is string => !!x), labelNames: r.labels, subtasks: [] };
  }

  /** Suggests (and optionally creates) subtasks with estimates. */
  async breakdown(taskId: string, userId: string, apply: boolean) {
    const task = await this.access.task(taskId, userId, apply ? 'MEMBER' : 'VIEWER');
    this.limiter.check(userId);
    const { locale } = await this.locale(userId);
    const raw = await this.ai.complete(
      [
        { role: 'system', content: this.systemPrompt(locale) },
        {
          role: 'user',
          content: [
            'BREAKDOWN. Split this task into 3–7 concrete, ordered subtasks a small team can execute.',
            'Reply with JSON only: {"subtasks": [{"title": string, "estimateMin": number}]}',
            `Task: ${task.title}`,
            `Details: ${JSON.stringify(task.description ?? {})}`,
          ].join('\n'),
        },
      ],
      { json: true, temperature: 0.4 },
    );
    const data = extractJson<{ subtasks?: { title: string; estimateMin?: number }[] }>(raw);
    const subtasks = (data?.subtasks ?? [])
      .filter((s) => s?.title)
      .slice(0, 8)
      .map((s) => ({ title: String(s.title).slice(0, 200), estimateMin: Math.max(5, Math.min(480, Math.round(Number(s.estimateMin) || 30))) }));
    if (apply) {
      const owners = await this.prisma.taskAssignee.findMany({ where: { taskId, role: 'ASSIGNEE' } });
      for (const s of subtasks) {
        await this.tasks.create(task.projectId, userId, { title: s.title, estimateMin: s.estimateMin, parentId: taskId, assigneeIds: owners.map((o) => o.userId) });
      }
    }
    return { subtasks, applied: apply };
  }

  async summarize(taskId: string, userId: string) {
    const task = await this.access.task(taskId, userId);
    this.limiter.check(userId);
    const { locale } = await this.locale(userId);
    const [comments, checklist, subtasks] = await Promise.all([
      this.prisma.comment.findMany({ where: { taskId }, orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true } } }, take: 60 }),
      this.prisma.checklistItem.findMany({ where: { taskId }, orderBy: { order: 'asc' } }),
      this.prisma.task.findMany({ where: { parentId: taskId, deletedAt: null }, include: { status: true } }),
    ]);
    const context = {
      title: task.title,
      description: (task.description as { text?: string } | null)?.text ?? '',
      due: task.dueAt,
      checklist: checklist.map((c) => `${c.done ? '[x]' : '[ ]'} ${c.text}`),
      subtasks: subtasks.map((s) => `${s.title} (${s.status.name})`),
      discussion: comments.map((c) => `${c.author.name}: ${(c.body as { text: string }).text}`),
    };
    const summary = await this.ai.complete(
      [
        { role: 'system', content: this.systemPrompt(locale) },
        {
          role: 'user',
          content: `Summarize this task for a teammate who just joined: current state, decisions made, open questions, and the next step. Use short bullet points.\n${JSON.stringify(context)}`,
        },
      ],
      { temperature: 0.2 },
    );
    return { summary };
  }

  /** Builds a compact snapshot of the workspace the assistant can ground its answers in. */
  private async workspaceContext(workspaceId: string, userId: string, question: string) {
    const now = new Date();
    const open = { deletedAt: null, archivedAt: null, completedAt: null, project: { workspaceId, archivedAt: null } };
    const words = question
      .split(/[\s،,.?!؟]+/)
      .filter((w) => w.length > 2)
      .slice(0, 6);
    const [members, mine, overdue, activity, sprints, goals, found] = await Promise.all([
      this.prisma.membership.findMany({ where: { workspaceId }, include: { user: { select: { id: true, name: true } } } }),
      this.prisma.task.findMany({
        where: { ...open, assignees: { some: { userId, role: 'ASSIGNEE' } } },
        include: { status: true, project: { select: { key: true, name: true } } },
        orderBy: [{ dueAt: { sort: 'asc', nulls: 'last' } }],
        take: 30,
      }),
      this.prisma.task.findMany({
        where: { ...open, dueAt: { lt: now } },
        include: { assignees: { include: { user: { select: { name: true } } } }, project: { select: { key: true } } },
        take: 20,
      }),
      this.prisma.activity.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 25 }),
      this.prisma.sprint.findMany({ where: { project: { workspaceId }, state: 'ACTIVE' }, include: { project: { select: { name: true } } } }),
      this.prisma.goal.findMany({ where: { workspaceId }, include: { keyResults: true }, take: 10, orderBy: { createdAt: 'desc' } }),
      words.length
        ? this.prisma.task.findMany({
            where: { deletedAt: null, project: { workspaceId }, OR: words.map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })) },
            include: { status: true, assignees: { include: { user: { select: { name: true } } } }, project: { select: { key: true } } },
            take: 12,
          })
        : Promise.resolve([]),
    ]);
    const names = new Map(members.map((m) => [m.userId, m.user.name]));
    const taskTitles = new Map(
      (await this.prisma.task.findMany({ where: { id: { in: activity.map((a) => a.entityId) } }, select: { id: true, title: true } })).map((t) => [t.id, t.title]),
    );
    const workload = await this.prisma.taskAssignee.groupBy({ by: ['userId'], where: { role: 'ASSIGNEE', task: open }, _count: true });
    return {
      team: members.map((m) => ({ name: m.user.name, role: m.role, openTasks: workload.find((w) => w.userId === m.userId)?._count ?? 0 })),
      myOpenTasks: mine.map((t) => ({ key: `${t.project.key}-${t.number}`, title: t.title, status: t.status.name, priority: t.priority, due: t.dueAt?.toISOString().slice(0, 10) })),
      overdue: overdue.map((t) => ({ key: `${t.project.key}-${t.number}`, title: t.title, due: t.dueAt?.toISOString().slice(0, 10), assignees: t.assignees.map((a) => a.user.name) })),
      activeSprints: sprints.map((s) => ({ name: s.name, project: s.project.name, ends: s.endAt.toISOString().slice(0, 10), goal: s.goal })),
      goals: goals.map((g) => ({ title: g.title, period: g.period, keyResults: g.keyResults.map((k) => `${k.title}: ${k.current}/${k.target}`) })),
      recentActivity: activity.map((a) => `${names.get(a.actorId) ?? '?'} ${a.action} "${taskTitles.get(a.entityId) ?? ''}" ${a.createdAt.toISOString().slice(0, 16)}`),
      relatedTasks: found.map((t) => ({
        key: `${t.project.key}-${t.number}`,
        title: t.title,
        status: t.status.name,
        done: !!t.completedAt,
        assignees: t.assignees.map((a) => a.user.name),
      })),
    };
  }

  async chat(workspaceId: string, userId: string, messages: ChatMessage[]) {
    await this.access.membership(workspaceId, userId);
    this.limiter.check(userId);
    const me = await this.locale(userId);
    const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-10);
    const question = history.filter((m) => m.role === 'user').pop()?.content ?? '';
    const context = await this.workspaceContext(workspaceId, userId, question);
    const reply = await this.ai.complete(
      [
        { role: 'system', content: `${this.systemPrompt(me.locale)}\nThe user is ${me.name}. Workspace snapshot (JSON):\n${JSON.stringify(context)}` },
        ...history.map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
      ],
      { temperature: 0.4 },
    );
    return { reply };
  }

  /** Daily standup: done yesterday, plan for today, blockers. Template text when AI is off. */
  async standup(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    const me = await this.locale(userId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 86400000);
    const base = { deletedAt: null, project: { workspaceId }, assignees: { some: { userId, role: 'ASSIGNEE' as const } } };
    const [done, todo, blocked] = await Promise.all([
      this.prisma.task.findMany({ where: { ...base, completedAt: { gte: yesterday } }, select: { title: true } }),
      this.prisma.task.findMany({
        where: { ...base, completedAt: null, OR: [{ dueAt: { lt: new Date(today.getTime() + 86400000) } }, { status: { category: 'IN_PROGRESS' } }] },
        select: { title: true },
        take: 10,
      }),
      this.prisma.task.findMany({
        where: { ...base, completedAt: null, dependents: { some: { type: 'BLOCKS', from: { completedAt: null, deletedAt: null } } } },
        select: { title: true },
      }),
    ]);
    const fa = me.locale === 'fa';
    const list = (items: { title: string }[]) => (items.length ? items.map((i) => `• ${i.title}`).join('\n') : fa ? '• —' : '• —');
    const template = fa
      ? `✅ دیروز:\n${list(done)}\n\n🎯 امروز:\n${list(todo)}\n\n⛔ موانع:\n${list(blocked)}`
      : `✅ Yesterday:\n${list(done)}\n\n🎯 Today:\n${list(todo)}\n\n⛔ Blockers:\n${list(blocked)}`;
    if (!this.ai.enabled) return { text: template, source: 'rules' as const };
    this.limiter.check(userId);
    const text = await this.ai.complete(
      [
        { role: 'system', content: this.systemPrompt(me.locale) },
        { role: 'user', content: `Rewrite this standup so it reads naturally and briefly, keeping the three sections and every item:\n${template}` },
      ],
      { temperature: 0.3 },
    );
    return { text, source: 'ai' as const };
  }
}
