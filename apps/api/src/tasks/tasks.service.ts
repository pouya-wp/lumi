import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { nextOccurrence, parseRRule, rankBetween } from '@lumi/shared';
import { Prisma, type AssigneeRole, type Project, type StatusCategory, type Task } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { Events, type TaskEvent } from '../common/events';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { coerceFieldValue } from '../fields/fields.service';
import {
  ChecklistCreateDto,
  ChecklistUpdateDto,
  CreateTaskDto,
  DependencyDto,
  ListTasksQuery,
  MoveTaskDto,
  MyTasksQuery,
  ProposalDto,
  RangeTasksQuery,
  SetAssigneesDto,
  UpdateTaskDto,
} from './tasks.dto';

const LABEL_COLORS = ['#4F5BFF', '#F43F5E', '#16A34A', '#F97316', '#EAB308', '#8B5CF6', '#0EA5E9'];

const userBrief = { id: true, name: true, email: true, avatarUrl: true } as const;

export const taskListInclude = {
  status: { select: { id: true, name: true, category: true, color: true } },
  project: { select: { id: true, key: true, name: true, color: true, icon: true, workspaceId: true } },
  assignees: { include: { user: { select: userBrief } } },
  labels: { include: { label: true } },
  checklist: { select: { done: true } },
  dependencies: { select: { toTaskId: true, type: true } },
  _count: { select: { subtasks: { where: { deletedAt: null } }, comments: true, attachments: true } },
} satisfies Prisma.TaskInclude;

type TaskWithList = Prisma.TaskGetPayload<{ include: typeof taskListInclude }>;

/** Flattens relations into the shape clients render. */
export function serializeTask(task: TaskWithList) {
  const { assignees, labels, checklist, _count, ...rest } = task;
  return {
    ...rest,
    key: `${task.project.key}-${task.number}`,
    assignees: assignees.map((a) => ({ ...a.user, role: a.role })),
    labels: labels.map((l) => l.label),
    checklist: { done: checklist.filter((c) => c.done).length, total: checklist.length },
    counts: _count,
  };
}

const PRIORITY_ORDER = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 } as const;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  async list(projectId: string, userId: string, q: ListTasksQuery) {
    await this.access.project(projectId, userId);
    const where: Prisma.TaskWhereInput = {
      projectId,
      deletedAt: null,
      archivedAt: null,
      statusId: q.statusId,
      priority: q.priority,
      ...(q.includeSubtasks === 'true' ? {} : { parentId: q.parentId ?? null }),
      ...(q.assigneeId ? { assignees: { some: { userId: q.assigneeId === 'me' ? userId : q.assigneeId, role: 'ASSIGNEE' } } } : {}),
      ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
      ...(q.labelId ? { labels: { some: { labelId: q.labelId } } } : {}),
      ...(q.categories ? { status: { category: { in: q.categories.split(',') as StatusCategory[] } } } : {}),
    };
    const tasks = await this.prisma.task.findMany({ where, include: taskListInclude, orderBy: { orderKey: 'asc' } });
    return tasks.map(serializeTask);
  }

  async range(workspaceId: string, userId: string, q: RangeTasksQuery) {
    await this.access.membership(workspaceId, userId);
    const from = new Date(q.from);
    const to = new Date(q.to);
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
        project: { workspaceId, archivedAt: null },
        projectId: q.projectId,
        ...(q.assigneeId ? { assignees: { some: { userId: q.assigneeId === 'me' ? userId : q.assigneeId, role: 'ASSIGNEE' } } } : {}),
        ...(q.includeDone === 'true' ? {} : { status: { category: { notIn: ['DONE', 'CANCELED'] } } }),
        OR: [
          { dueAt: { gte: from, lt: to } },
          { startAt: { gte: from, lt: to } },
          { startAt: { lt: from }, dueAt: { gte: to } },
        ],
      },
      include: taskListInclude,
      orderBy: [{ startAt: { sort: 'asc', nulls: 'last' } }, { dueAt: 'asc' }],
      take: 1000,
    });
    return tasks.map(serializeTask);
  }

  async myTasks(userId: string, q: MyTasksQuery) {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const scope = q.scope ?? 'open';
    const open: Prisma.TaskWhereInput = { status: { category: { notIn: ['DONE', 'CANCELED'] } } };
    const scopeWhere: Record<typeof scope, Prisma.TaskWhereInput> = {
      open,
      today: { ...open, dueAt: { lte: endOfDay } },
      overdue: { ...open, dueAt: { lt: now } },
      upcoming: { ...open, dueAt: { gt: endOfDay } },
      done: { status: { category: 'DONE' } },
    };
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        archivedAt: null,
        assignees: { some: { userId, role: 'ASSIGNEE' } },
        proposalState: { not: 'DECLINED' },
        project: { archivedAt: null, workspace: { memberships: { some: { userId } } }, ...(q.workspaceId ? { workspaceId: q.workspaceId } : {}) },
        ...scopeWhere[scope],
      },
      include: taskListInclude,
      orderBy: scope === 'done' ? { completedAt: 'desc' } : [{ dueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }],
      take: 200,
    });
    const serialized = tasks.map(serializeTask);
    if (scope !== 'done') {
      // Same due date → higher priority first.
      serialized.sort((a, b) =>
        (a.dueAt?.getTime() ?? Infinity) === (b.dueAt?.getTime() ?? Infinity)
          ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
          : 0,
      );
    }
    return serialized;
  }

  async search(workspaceId: string, userId: string, term: string) {
    await this.access.membership(workspaceId, userId);
    const q = term.trim();
    if (!q) return { tasks: [], projects: [] };
    const keyMatch = /^([A-Za-z][A-Za-z0-9]*)-(\d+)$/.exec(q);
    const [tasks, projects] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          project: { workspaceId, archivedAt: null },
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            ...(keyMatch ? [{ number: Number(keyMatch[2]), project: { key: keyMatch[1].toUpperCase() } }] : []),
          ],
        },
        include: taskListInclude,
        take: 20,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.findMany({
        where: { workspaceId, archivedAt: null, name: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
    ]);
    return { tasks: tasks.map(serializeTask), projects };
  }

  async get(taskId: string, userId: string) {
    await this.access.task(taskId, userId);
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        ...taskListInclude,
        createdBy: { select: userBrief },
        parent: { select: { id: true, title: true, number: true } },
        checklist: { orderBy: { order: 'asc' } },
        subtasks: { where: { deletedAt: null }, include: taskListInclude, orderBy: { orderKey: 'asc' } },
        dependencies: { include: { to: { select: { id: true, title: true, number: true, statusId: true } } } },
        dependents: { include: { from: { select: { id: true, title: true, number: true, statusId: true } } } },
      },
    });
    const { checklist, subtasks, ...rest } = task;
    return {
      ...serializeTask({ ...rest, checklist }),
      checklistItems: checklist,
      subtasks: subtasks.map(serializeTask),
    };
  }

  async create(projectId: string, userId: string, dto: CreateTaskDto) {
    const project = await this.access.project(projectId, userId, 'MEMBER');
    const statuses = await this.prisma.status.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
    const status = dto.statusId
      ? statuses.find((s) => s.id === dto.statusId)
      : (statuses.find((s) => s.category === 'TODO') ?? statuses[0]);
    if (!status) throw new BadRequestException('Invalid status');

    if (dto.parentId) {
      const parent = await this.prisma.task.findFirst({ where: { id: dto.parentId, projectId, deletedAt: null } });
      if (!parent) throw new BadRequestException('Parent task must belong to the same project');
    }

    const assigneeIds = [...new Set(dto.assigneeIds ?? [])];
    await this.assertMembers(project.workspaceId, assigneeIds);
    const labelIds = await this.resolveLabels(project.workspaceId, dto.labelIds ?? [], dto.labelNames ?? []);

    const others = assigneeIds.filter((id) => id !== userId);
    const proposalState = this.proposalsEnabled(project) && others.length > 0 ? 'PROPOSED' : 'NONE';
    if (dto.recurrence && !parseRRule(dto.recurrence)) throw new BadRequestException('Invalid recurrence rule');
    const customFields = dto.customFields ? await this.mergeCustomFields(project, {}, dto.customFields) : undefined;

    const task = await this.prisma.$transaction(async (tx) => {
      const { taskCounter } = await tx.project.update({ where: { id: projectId }, data: { taskCounter: { increment: 1 } } });
      const last = await tx.task.findFirst({ where: { statusId: status.id }, orderBy: { orderKey: 'desc' }, select: { orderKey: true } });
      return tx.task.create({
        data: {
          projectId,
          number: taskCounter,
          title: dto.title,
          description: dto.description as Prisma.InputJsonValue | undefined,
          statusId: status.id,
          priority: dto.priority ?? 'NONE',
          startAt: dto.startAt ? new Date(dto.startAt) : undefined,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          estimateMin: dto.estimateMin,
          storyPoints: dto.storyPoints,
          parentId: dto.parentId,
          createdById: userId,
          proposalState,
          recurrence: dto.recurrence,
          customFields: customFields as Prisma.InputJsonValue | undefined,
          orderKey: rankBetween(last?.orderKey ?? null, null),
          completedAt: status.category === 'DONE' ? new Date() : null,
          assignees: { create: assigneeIds.map((id) => ({ userId: id, role: 'ASSIGNEE' as const })) },
          labels: { create: labelIds.map((labelId) => ({ labelId })) },
        },
        include: taskListInclude,
      });
    });

    this.emit(Events.TaskCreated, project, task.id, userId, 'created', { title: task.title });
    await this.notifications.notify(others, userId, proposalState === 'PROPOSED' ? 'task.proposed' : 'task.assigned', this.payload(task, project));
    return serializeTask(task);
  }

  async update(taskId: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    const { archived, customFields, ...fields } = dto;
    if (fields.recurrence && !parseRRule(fields.recurrence)) throw new BadRequestException('Invalid recurrence rule');
    const data: Prisma.TaskUncheckedUpdateInput = {
      ...fields,
      customFields: customFields
        ? ((await this.mergeCustomFields(task.project, (task.customFields as Record<string, unknown>) ?? {}, customFields)) as Prisma.InputJsonValue)
        : undefined,
      description: fields.description as Prisma.InputJsonValue | undefined,
      startAt: toDate(fields.startAt),
      dueAt: toDate(fields.dueAt),
    };
    if (archived !== undefined) data.archivedAt = archived ? new Date() : null;
    return this.applyUpdate(task, userId, data);
  }

  async move(taskId: string, userId: string, dto: MoveTaskDto) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    const [before, after] = await Promise.all([this.sibling(dto.beforeId, task.projectId), this.sibling(dto.afterId, task.projectId)]);
    let orderKey: string;
    if (before && after && before.orderKey < after.orderKey) {
      orderKey = rankBetween(before.orderKey, after.orderKey);
    } else if (before && !after) {
      const next = await this.prisma.task.findFirst({
        where: { statusId: dto.statusId, orderKey: { gt: before.orderKey }, id: { not: task.id } },
        orderBy: { orderKey: 'asc' },
      });
      orderKey = rankBetween(before.orderKey, next?.orderKey ?? null);
    } else if (after && !before) {
      const prev = await this.prisma.task.findFirst({
        where: { statusId: dto.statusId, orderKey: { lt: after.orderKey }, id: { not: task.id } },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = rankBetween(prev?.orderKey ?? null, after.orderKey);
    } else {
      const last = await this.prisma.task.findFirst({
        where: { statusId: dto.statusId, id: { not: task.id } },
        orderBy: { orderKey: 'desc' },
      });
      orderKey = rankBetween(last?.orderKey ?? null, null);
    }
    return this.applyUpdate(task, userId, { statusId: dto.statusId, orderKey });
  }

  async remove(taskId: string, userId: string) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    await this.prisma.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
    this.emit(Events.TaskDeleted, task.project, taskId, userId, 'deleted', { title: task.title });
  }

  async setAssignees(taskId: string, userId: string, dto: SetAssigneesDto) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    const role: AssigneeRole = dto.role ?? 'ASSIGNEE';
    const userIds = [...new Set(dto.userIds)];
    await this.assertMembers(task.project.workspaceId, userIds);

    const current = await this.prisma.taskAssignee.findMany({ where: { taskId, role } });
    const currentIds = new Set(current.map((a) => a.userId));
    const added = userIds.filter((id) => !currentIds.has(id));
    const removed = [...currentIds].filter((id) => !userIds.includes(id));

    await this.prisma.$transaction([
      this.prisma.taskAssignee.deleteMany({ where: { taskId, role, userId: { in: removed } } }),
      this.prisma.taskAssignee.createMany({ data: added.map((id) => ({ taskId, userId: id, role })) }),
    ]);

    const addedOthers = added.filter((id) => id !== userId);
    let proposalState = task.proposalState;
    if (role === 'ASSIGNEE') {
      if (userIds.length === 0) proposalState = 'NONE';
      else if (addedOthers.length > 0 && this.proposalsEnabled(task.project)) proposalState = 'PROPOSED';
    }
    const updated = await this.applyUpdate(task, userId, { proposalState }, { assignees: { added, removed, role } });
    if (addedOthers.length) {
      const type = role === 'ASSIGNEE' && proposalState === 'PROPOSED' ? 'task.proposed' : 'task.assigned';
      await this.notifications.notify(addedOthers, userId, type, { ...this.payload(task, task.project), role });
    }
    return updated;
  }

  async setLabels(taskId: string, userId: string, labelIds: string[]) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    const ids = await this.resolveLabels(task.project.workspaceId, labelIds, []);
    await this.prisma.$transaction([
      this.prisma.taskLabel.deleteMany({ where: { taskId } }),
      this.prisma.taskLabel.createMany({ data: ids.map((labelId) => ({ taskId, labelId })) }),
    ]);
    return this.applyUpdate(task, userId, {}, { labels: ids });
  }

  /**
   * Proposal flow for tasks assigned to someone else:
   * assignee accepts, declines (with a note) or counters with a new due date;
   * the creator can accept a counter-offer, which applies the proposed due date.
   */
  async respondToProposal(taskId: string, userId: string, dto: ProposalDto) {
    const task = await this.access.task(taskId, userId);
    if (task.proposalState !== 'PROPOSED') throw new BadRequestException('Task has no open proposal');
    const assignees = await this.prisma.taskAssignee.findMany({ where: { taskId, role: 'ASSIGNEE' } });
    const isAssignee = assignees.some((a) => a.userId === userId);
    const isCreator = task.createdById === userId;
    const payload = this.payload(task, task.project);

    if (isCreator && !isAssignee) {
      if (dto.action !== 'accept' || !task.proposedDueAt) throw new ForbiddenException('Only the assignee can respond');
      const updated = await this.applyUpdate(task, userId, {
        proposalState: 'ACCEPTED',
        dueAt: task.proposedDueAt,
        proposedDueAt: null,
      });
      await this.notifications.notify(assignees.map((a) => a.userId), userId, 'task.proposal.accepted', payload);
      return updated;
    }
    if (!isAssignee) throw new ForbiddenException('Only the assignee can respond');

    if (dto.action === 'accept') {
      const updated = await this.applyUpdate(task, userId, { proposalState: 'ACCEPTED', proposalNote: dto.note ?? null });
      await this.notifications.notify([task.createdById], userId, 'task.proposal.accepted', payload);
      return updated;
    }
    if (dto.action === 'decline') {
      const updated = await this.applyUpdate(task, userId, { proposalState: 'DECLINED', proposalNote: dto.note ?? null });
      await this.notifications.notify([task.createdById], userId, 'task.proposal.declined', { ...payload, note: dto.note });
      return updated;
    }
    const updated = await this.applyUpdate(task, userId, { proposedDueAt: new Date(dto.dueAt!), proposalNote: dto.note ?? null });
    await this.notifications.notify([task.createdById], userId, 'task.proposal.countered', {
      ...payload,
      note: dto.note,
      proposedDueAt: dto.dueAt,
    });
    return updated;
  }

  async addChecklistItem(taskId: string, userId: string, dto: ChecklistCreateDto) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    const last = await this.prisma.checklistItem.findFirst({ where: { taskId }, orderBy: { order: 'desc' } });
    const item = await this.prisma.checklistItem.create({ data: { taskId, text: dto.text, order: (last?.order ?? -1) + 1 } });
    this.emit(Events.TaskUpdated, task.project, taskId, userId, 'checklist.added', { text: dto.text });
    return item;
  }

  async updateChecklistItem(itemId: string, userId: string, dto: ChecklistUpdateDto) {
    const item = await this.findChecklistItem(itemId);
    const task = await this.access.task(item.taskId, userId, 'MEMBER');
    const updated = await this.prisma.checklistItem.update({ where: { id: itemId }, data: dto });
    this.emit(Events.TaskUpdated, task.project, task.id, userId, 'checklist.updated', { ...dto, text: updated.text });
    return updated;
  }

  async removeChecklistItem(itemId: string, userId: string) {
    const item = await this.findChecklistItem(itemId);
    const task = await this.access.task(item.taskId, userId, 'MEMBER');
    await this.prisma.checklistItem.delete({ where: { id: itemId } });
    this.emit(Events.TaskUpdated, task.project, task.id, userId, 'checklist.removed', { text: item.text });
  }

  async addDependency(taskId: string, userId: string, dto: DependencyDto) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    if (dto.toTaskId === taskId) throw new BadRequestException('A task cannot depend on itself');
    const target = await this.access.task(dto.toTaskId, userId);
    if (target.project.workspaceId !== task.project.workspaceId) throw new BadRequestException('Tasks must share a workspace');
    if (dto.type === 'BLOCKS' && (await this.reachable(dto.toTaskId, taskId))) {
      throw new BadRequestException('This dependency would create a cycle');
    }
    await this.prisma.taskDependency.upsert({
      where: { fromTaskId_toTaskId_type: { fromTaskId: taskId, toTaskId: dto.toTaskId, type: dto.type } },
      create: { fromTaskId: taskId, toTaskId: dto.toTaskId, type: dto.type },
      update: {},
    });
    this.emit(Events.TaskUpdated, task.project, taskId, userId, 'dependency.added', { ...dto });
  }

  async removeDependency(taskId: string, userId: string, toTaskId: string, type: DependencyDto['type']) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    await this.prisma.taskDependency.deleteMany({ where: { fromTaskId: taskId, toTaskId, type } });
    this.emit(Events.TaskUpdated, task.project, taskId, userId, 'dependency.removed', { toTaskId, type });
  }

  async activity(taskId: string, userId: string) {
    const task = await this.access.task(taskId, userId);
    const items = await this.prisma.activity.findMany({
      where: { workspaceId: task.project.workspaceId, entity: 'task', entityId: taskId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const actors = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.actorId))] } },
      select: userBrief,
    });
    const byId = new Map(actors.map((a) => [a.id, a]));
    return items.map((i) => ({ ...i, actor: byId.get(i.actorId) ?? null }));
  }

  /** Applies an update, records a field-level diff and publishes it. */
  private async applyUpdate(
    task: Task & { project: Project },
    userId: string,
    data: Prisma.TaskUncheckedUpdateInput,
    extraDiff: Record<string, unknown> = {},
  ) {
    let statusChanged = false;
    if (typeof data.statusId === 'string' && data.statusId !== task.statusId) {
      const status = await this.prisma.status.findFirst({ where: { id: data.statusId, projectId: task.projectId } });
      if (!status) throw new BadRequestException('Status does not belong to this project');
      statusChanged = true;
      const wasDone = !!task.completedAt;
      if (status.category === 'DONE' && !wasDone) data.completedAt = new Date();
      if (status.category !== 'DONE' && wasDone) data.completedAt = null;
    }

    const completing = data.completedAt instanceof Date && !task.completedAt;
    if (completing && task.recurrence) data.recurrence = null;
    const updated = await this.prisma.task.update({ where: { id: task.id }, data, include: taskListInclude });
    if (completing && task.recurrence) await this.spawnNext(task, userId);

    const diff: Record<string, unknown> = { ...extraDiff };
    for (const key of Object.keys(data) as (keyof Task)[]) {
      if (key === 'orderKey' || key === 'description') continue;
      const before = task[key];
      const after = updated[key as keyof typeof updated];
      if (String(before) !== String(after)) diff[key] = { from: before, to: after };
    }
    if (data.description !== undefined) diff.description = true;

    if (Object.keys(diff).length > 0 || data.orderKey) {
      this.emit(Events.TaskUpdated, task.project, task.id, userId, statusChanged ? 'status.changed' : 'updated', diff);
    }
    if (statusChanged) {
      const watchers = await this.prisma.taskAssignee.findMany({ where: { taskId: task.id } });
      await this.notifications.notify(
        [task.createdById, ...watchers.map((w) => w.userId)],
        userId,
        'task.status',
        { ...this.payload(updated, task.project), status: updated.status.name },
      );
    }
    return serializeTask(updated);
  }

  /** Creates the next instance of a recurring task; the series continues on the new task. */
  private async spawnNext(task: Task & { project: Project }, userId: string) {
    const anchor = task.dueAt ?? new Date();
    const nextDue = nextOccurrence(task.recurrence!, anchor);
    if (!nextDue) return;
    const shift = nextDue.getTime() - anchor.getTime();
    const [assignees, labels, todo] = await Promise.all([
      this.prisma.taskAssignee.findMany({ where: { taskId: task.id } }),
      this.prisma.taskLabel.findMany({ where: { taskId: task.id } }),
      this.prisma.status.findFirst({ where: { projectId: task.projectId, category: 'TODO' }, orderBy: { order: 'asc' } }),
    ]);
    const statusId = todo?.id ?? task.statusId;
    const next = await this.prisma.$transaction(async (tx) => {
      const { taskCounter } = await tx.project.update({ where: { id: task.projectId }, data: { taskCounter: { increment: 1 } } });
      const last = await tx.task.findFirst({ where: { statusId }, orderBy: { orderKey: 'desc' }, select: { orderKey: true } });
      return tx.task.create({
        data: {
          projectId: task.projectId,
          number: taskCounter,
          parentId: task.parentId,
          title: task.title,
          description: task.description ?? undefined,
          statusId,
          priority: task.priority,
          estimateMin: task.estimateMin,
          storyPoints: task.storyPoints,
          startAt: task.startAt ? new Date(task.startAt.getTime() + shift) : null,
          dueAt: nextDue,
          recurrence: task.recurrence,
          customFields: task.customFields ?? undefined,
          createdById: task.createdById,
          orderKey: rankBetween(last?.orderKey ?? null, null),
          assignees: { create: assignees.map((a) => ({ userId: a.userId, role: a.role })) },
          labels: { create: labels.map((l) => ({ labelId: l.labelId })) },
        },
      });
    });
    this.emit(Events.TaskCreated, task.project, next.id, userId, 'recurred', { from: task.id, title: next.title });
  }

  private async mergeCustomFields(project: Project, current: Record<string, unknown>, patch: Record<string, unknown>) {
    const fields = await this.prisma.customField.findMany({ where: { projectId: project.id, id: { in: Object.keys(patch) } } });
    if (fields.length !== Object.keys(patch).length) throw new BadRequestException('Unknown custom field');
    const members = new Set((await this.prisma.membership.findMany({ where: { workspaceId: project.workspaceId }, select: { userId: true } })).map((m) => m.userId));
    const next = { ...current };
    for (const field of fields) {
      const value = coerceFieldValue(field, patch[field.id], members);
      if (value === null) delete next[field.id];
      else next[field.id] = value;
    }
    return next;
  }

  private async sibling(id: string | undefined, projectId: string) {
    if (!id) return null;
    return this.prisma.task.findFirst({ where: { id, projectId }, select: { orderKey: true } });
  }

  private async findChecklistItem(id: string) {
    const item = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Checklist item not found');
    return item;
  }

  /** True if `to` can be reached from `from` by following BLOCKS edges. */
  private async reachable(from: string, to: string) {
    const seen = new Set<string>([from]);
    let frontier = [from];
    while (frontier.length) {
      const edges = await this.prisma.taskDependency.findMany({
        where: { fromTaskId: { in: frontier }, type: 'BLOCKS' },
        select: { toTaskId: true },
      });
      frontier = [];
      for (const { toTaskId } of edges) {
        if (toTaskId === to) return true;
        if (!seen.has(toTaskId)) {
          seen.add(toTaskId);
          frontier.push(toTaskId);
        }
      }
    }
    return false;
  }

  private async assertMembers(workspaceId: string, userIds: string[]) {
    if (!userIds.length) return;
    const count = await this.prisma.membership.count({ where: { workspaceId, userId: { in: userIds } } });
    if (count !== userIds.length) throw new BadRequestException('All assignees must be workspace members');
  }

  private async resolveLabels(workspaceId: string, labelIds: string[], labelNames: string[]) {
    const ids = new Set<string>();
    if (labelIds.length) {
      const found = await this.prisma.label.findMany({ where: { workspaceId, id: { in: labelIds } }, select: { id: true } });
      if (found.length !== new Set(labelIds).size) throw new BadRequestException('Unknown label');
      found.forEach((l) => ids.add(l.id));
    }
    for (const name of new Set(labelNames.map((n) => n.trim()).filter(Boolean))) {
      const existing = await this.prisma.label.findFirst({ where: { workspaceId, name: { equals: name, mode: 'insensitive' } } });
      if (existing) {
        ids.add(existing.id);
        continue;
      }
      const count = await this.prisma.label.count({ where: { workspaceId } });
      const created = await this.prisma.label.create({ data: { workspaceId, name, color: LABEL_COLORS[count % LABEL_COLORS.length] } });
      ids.add(created.id);
    }
    return [...ids];
  }

  private proposalsEnabled(project: Project) {
    return (project.settings as { proposals?: boolean } | null)?.proposals !== false;
  }

  private payload(task: { id: string; title: string; number: number }, project: Project) {
    return { taskId: task.id, title: task.title, key: `${project.key}-${task.number}`, projectId: project.id, workspaceId: project.workspaceId };
  }

  private emit(event: string, project: Project, taskId: string, actorId: string, action: string, diff?: Record<string, unknown>) {
    this.events.emit(event, { workspaceId: project.workspaceId, projectId: project.id, taskId, actorId, action, diff } satisfies TaskEvent);
  }
}

function toDate(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}
