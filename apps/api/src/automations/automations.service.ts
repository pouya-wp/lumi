import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma, type Automation, type Priority } from '@prisma/client';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { automationContext } from '../common/automation-context';
import { Events, type CommentEvent, type TaskEvent } from '../common/events';
import { CommentsService } from '../comments/comments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

export const TRIGGERS = ['task.created', 'status.changed', 'priority.changed', 'assignee.added', 'comment.created', 'due.approaching'] as const;
export const ACTIONS = ['set_status', 'set_priority', 'assign', 'add_label', 'set_due', 'create_subtask', 'add_checklist', 'comment', 'notify', 'move_to_sprint', 'webhook'] as const;
const MAX_DEPTH = 3;

export interface Trigger {
  type: (typeof TRIGGERS)[number];
  params?: { toStatusId?: string; toCategory?: string; toPriority?: Priority; hours?: number };
}
export interface Condition {
  field: 'priority' | 'statusCategory' | 'statusId' | 'assigneeId' | 'labelId' | 'title' | 'hasDue' | 'unassigned';
  op: 'eq' | 'neq' | 'contains' | 'in';
  value?: unknown;
}
export interface Action {
  type: (typeof ACTIONS)[number];
  params?: Record<string, unknown>;
}

export class AutomationDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsObject() trigger!: Trigger;
  @IsOptional() @IsArray() conditions?: Condition[];
  @IsArray() actions!: Action[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

export class UpdateAutomationDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsObject() trigger?: Trigger;
  @IsOptional() @IsArray() conditions?: Condition[];
  @IsOptional() @IsArray() actions?: Action[];
  @IsOptional() @IsBoolean() enabled?: boolean;
}

type TaskForRules = Prisma.TaskGetPayload<{
  include: { status: true; assignees: true; labels: true; project: true };
}>;

function validate(dto: { trigger?: Trigger; actions?: Action[]; conditions?: Condition[] }) {
  if (dto.trigger && !TRIGGERS.includes(dto.trigger.type)) throw new BadRequestException('Unknown trigger');
  if (dto.actions && (!dto.actions.length || dto.actions.some((a) => !ACTIONS.includes(a.type)))) throw new BadRequestException('Invalid actions');
  for (const a of dto.actions ?? []) {
    if (a.type === 'webhook' && !/^https:\/\/\S+$/.test(String(a.params?.url ?? ''))) throw new BadRequestException('Webhook URL must be https');
  }
  if (dto.conditions?.some((c) => !c || typeof c.field !== 'string')) throw new BadRequestException('Invalid conditions');
}

/** Evaluates a condition list (all must pass) against a task. */
export function matches(task: TaskForRules, conditions: Condition[]): boolean {
  return conditions.every((c) => {
    const owners = task.assignees.filter((a) => a.role === 'ASSIGNEE').map((a) => a.userId);
    const cmp = (actual: unknown) => {
      switch (c.op) {
        case 'eq':
          return actual === c.value;
        case 'neq':
          return actual !== c.value;
        case 'in':
          return Array.isArray(c.value) && c.value.includes(actual);
        case 'contains':
          return typeof actual === 'string' && typeof c.value === 'string' && actual.toLowerCase().includes(c.value.toLowerCase());
      }
    };
    switch (c.field) {
      case 'priority':
        return cmp(task.priority);
      case 'statusCategory':
        return cmp(task.status.category);
      case 'statusId':
        return cmp(task.statusId);
      case 'title':
        return cmp(task.title);
      case 'assigneeId':
        return c.op === 'neq' ? !owners.includes(String(c.value)) : owners.includes(String(c.value));
      case 'labelId':
        return c.op === 'neq' ? !task.labels.some((l) => l.labelId === c.value) : task.labels.some((l) => l.labelId === c.value);
      case 'hasDue':
        return !!task.dueAt === (c.value !== false);
      case 'unassigned':
        return (owners.length === 0) === (c.value !== false);
    }
  });
}

/** Rule engine: listens to task/comment events, checks conditions and runs actions as the rule's author. */
@Injectable()
export class AutomationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AutomationsService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== 'test') this.timer = setInterval(() => this.runDueApproaching().catch((e) => this.logger.error(e)), 10 * 60 * 1000);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async list(projectId: string, userId: string) {
    await this.access.project(projectId, userId);
    return this.prisma.automation.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
  }

  async create(projectId: string, userId: string, dto: AutomationDto) {
    await this.access.project(projectId, userId, 'MEMBER');
    validate(dto);
    return this.prisma.automation.create({
      data: {
        projectId,
        name: dto.name,
        enabled: dto.enabled ?? true,
        trigger: dto.trigger as unknown as Prisma.InputJsonValue,
        conditions: (dto.conditions ?? []) as unknown as Prisma.InputJsonValue,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateAutomationDto) {
    const rule = await this.find(id);
    await this.access.project(rule.projectId, userId, 'MEMBER');
    validate(dto);
    return this.prisma.automation.update({
      where: { id },
      data: {
        name: dto.name,
        enabled: dto.enabled,
        trigger: dto.trigger as unknown as Prisma.InputJsonValue | undefined,
        conditions: dto.conditions as unknown as Prisma.InputJsonValue | undefined,
        actions: dto.actions as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(id: string, userId: string) {
    const rule = await this.find(id);
    await this.access.project(rule.projectId, userId, 'MEMBER');
    await this.prisma.automation.delete({ where: { id } });
  }

  async runs(id: string, userId: string) {
    const rule = await this.find(id);
    await this.access.project(rule.projectId, userId);
    return this.prisma.automationRun.findMany({ where: { automationId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  /** Dry run: reports whether the rule would fire on the task and what it would do. */
  async test(id: string, userId: string, taskId: string) {
    const rule = await this.find(id);
    await this.access.project(rule.projectId, userId);
    const task = await this.loadTask(taskId);
    if (!task || task.projectId !== rule.projectId) throw new BadRequestException('Task must belong to the rule project');
    const passes = matches(task, rule.conditions as unknown as Condition[]);
    return { matches: passes, actions: passes ? (rule.actions as unknown as Action[]).map((a) => ({ type: a.type, params: a.params ?? {} })) : [] };
  }

  @OnEvent(Events.TaskCreated, { async: true, promisify: true })
  @OnEvent(Events.TaskUpdated, { async: true, promisify: true })
  async onTask(e: TaskEvent) {
    if ((e.depth ?? 0) >= MAX_DEPTH) return;
    const types: Trigger['type'][] = [];
    if (e.action === 'created' || e.action === 'recurred') types.push('task.created');
    if (e.action === 'status.changed') types.push('status.changed');
    if (e.diff && 'priority' in e.diff) types.push('priority.changed');
    const added = (e.diff?.assignees as { added?: string[]; role?: string } | undefined)?.added;
    if (added?.length && (e.diff?.assignees as { role?: string }).role === 'ASSIGNEE') types.push('assignee.added');
    if (!types.length) return;
    await this.dispatch(e.projectId, e.taskId, types, e.depth ?? 0, e.diff);
  }

  @OnEvent(Events.CommentCreated, { async: true, promisify: true })
  async onComment(e: CommentEvent) {
    if ((e.depth ?? 0) >= MAX_DEPTH) return;
    await this.dispatch(e.projectId, e.taskId, ['comment.created'], e.depth ?? 0);
  }

  /** Fires due.approaching rules once per task for tasks due within the rule's window. */
  async runDueApproaching() {
    const rules = await this.prisma.automation.findMany({ where: { enabled: true, trigger: { path: ['type'], equals: 'due.approaching' } } });
    for (const rule of rules) {
      const hours = Number((rule.trigger as unknown as Trigger).params?.hours ?? 24);
      const tasks = await this.prisma.task.findMany({
        where: {
          projectId: rule.projectId,
          deletedAt: null,
          completedAt: null,
          dueAt: { gte: new Date(), lte: new Date(Date.now() + hours * 3600 * 1000) },
          NOT: { id: { in: (await this.prisma.automationRun.findMany({ where: { automationId: rule.id }, select: { taskId: true } })).map((r) => r.taskId!).filter(Boolean) } },
        },
        select: { id: true },
      });
      for (const t of tasks) await this.execute(rule, t.id, 0);
    }
  }

  private async dispatch(projectId: string, taskId: string, types: Trigger['type'][], depth: number, diff?: Record<string, unknown>) {
    const rules = await this.prisma.automation.findMany({ where: { projectId, enabled: true } });
    for (const rule of rules) {
      const trigger = rule.trigger as unknown as Trigger;
      if (!types.includes(trigger.type)) continue;
      if (trigger.type === 'status.changed') {
        const to = (diff?.statusId as { to?: string } | undefined)?.to;
        if (trigger.params?.toStatusId && trigger.params.toStatusId !== to) continue;
        if (trigger.params?.toCategory) {
          const status = to ? await this.prisma.status.findUnique({ where: { id: to } }) : null;
          if (status?.category !== trigger.params.toCategory) continue;
        }
      }
      if (trigger.type === 'priority.changed' && trigger.params?.toPriority) {
        if ((diff?.priority as { to?: string } | undefined)?.to !== trigger.params.toPriority) continue;
      }
      await this.execute(rule, taskId, depth);
    }
  }

  private loadTask(id: string) {
    return this.prisma.task.findFirst({ where: { id, deletedAt: null }, include: { status: true, assignees: true, labels: true, project: true } });
  }

  private async execute(rule: Automation, taskId: string, depth: number) {
    const task = await this.loadTask(taskId);
    if (!task) return;
    if (!matches(task, rule.conditions as unknown as Condition[])) return;
    const log: { type: string; ok: boolean; error?: string }[] = [];
    await automationContext.run({ depth: depth + 1, automationId: rule.id }, async () => {
      for (const action of rule.actions as unknown as Action[]) {
        try {
          // Reload so each action sees the effects of the previous ones (e.g. assign → notify assignees).
          const current = await this.loadTask(task.id);
          if (!current) break;
          await this.perform(rule, current, action);
          log.push({ type: action.type, ok: true });
        } catch (e) {
          log.push({ type: action.type, ok: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
    });
    const ok = log.every((l) => l.ok);
    await this.prisma.$transaction([
      this.prisma.automationRun.create({ data: { automationId: rule.id, taskId, status: ok ? 'SUCCESS' : 'FAILED', log } }),
      this.prisma.automation.update({ where: { id: rule.id }, data: { runCount: { increment: 1 }, lastRunAt: new Date() } }),
    ]);
  }

  private async perform(rule: Automation, task: TaskForRules, action: Action) {
    const actor = rule.createdById;
    const p = action.params ?? {};
    switch (action.type) {
      case 'set_status':
        await this.tasks.update(task.id, actor, { statusId: String(p.statusId) });
        return;
      case 'set_priority':
        await this.tasks.update(task.id, actor, { priority: p.priority as Priority });
        return;
      case 'assign': {
        const ids = (p.userIds as string[]) ?? [];
        const current = task.assignees.filter((a) => a.role === 'ASSIGNEE').map((a) => a.userId);
        await this.tasks.setAssignees(task.id, actor, { userIds: p.mode === 'replace' ? ids : [...new Set([...current, ...ids])] });
        return;
      }
      case 'add_label':
        await this.tasks.setLabels(task.id, actor, [...new Set([...task.labels.map((l) => l.labelId), String(p.labelId)])]);
        return;
      case 'set_due': {
        const due = new Date();
        due.setDate(due.getDate() + Number(p.inDays ?? 1));
        due.setHours(18, 0, 0, 0);
        await this.tasks.update(task.id, actor, { dueAt: due.toISOString() });
        return;
      }
      case 'create_subtask':
        await this.tasks.create(task.projectId, actor, { title: String(p.title), parentId: task.id });
        return;
      case 'add_checklist':
        for (const text of (p.items as string[]) ?? []) await this.tasks.addChecklistItem(task.id, actor, { text });
        return;
      case 'comment':
        await this.comments.create(task.id, actor, { text: String(p.text) });
        return;
      case 'notify': {
        const target = p.to ?? 'assignees';
        const recipients =
          target === 'creator' ? [task.createdById] : target === 'assignees' ? task.assignees.filter((a) => a.role === 'ASSIGNEE').map((a) => a.userId) : ((p.userIds as string[]) ?? []);
        await this.notifications.notify(recipients, 'automation', 'automation', {
          taskId: task.id,
          title: task.title,
          key: `${task.project.key}-${task.number}`,
          workspaceId: task.project.workspaceId,
          note: String(p.message ?? rule.name),
        });
        return;
      }
      case 'move_to_sprint': {
        const sprint = await this.prisma.sprint.findFirst({ where: { projectId: task.projectId, state: 'ACTIVE' } });
        if (!sprint) throw new Error('No active sprint');
        await this.tasks.update(task.id, actor, { sprintId: sprint.id });
        return;
      }
      case 'webhook': {
        const res = await fetch(String(p.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'Lumi-Automation' },
          body: JSON.stringify({ rule: rule.name, task: { id: task.id, key: `${task.project.key}-${task.number}`, title: task.title, status: task.status.name, priority: task.priority } }),
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
        return;
      }
    }
  }

  private async find(id: string) {
    const rule = await this.prisma.automation.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Automation not found');
    return rule;
  }
}
