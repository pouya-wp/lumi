import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AccessService } from '../common/access.service';
import { Events, type TaskEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';

export class LogTimeDto {
  @IsInt() @Min(1) @Max(24 * 60) minutes!: number;
  @IsOptional() @IsDateString() startedAt?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
  @IsOptional() @IsBoolean() billable?: boolean;
}

export class TimesheetQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsString() userId?: string;
}

const taskBrief = { select: { id: true, title: true, number: true, projectId: true, project: { select: { key: true, name: true, color: true, icon: true, workspaceId: true } } } } as const;
const userBrief = { select: { id: true, name: true, avatarUrl: true } } as const;

/** Duration in minutes, at least one. */
const minutesBetween = (a: Date, b: Date) => Math.max(1, Math.round((b.getTime() - a.getTime()) / 60000));

@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: EventEmitter2,
  ) {}

  async running(userId: string) {
    return this.prisma.timeEntry.findFirst({ where: { userId, endedAt: null }, include: { task: taskBrief } });
  }

  /** Starts a timer on the task, stopping any timer the user already has running. */
  async start(taskId: string, userId: string) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    await this.stop(userId);
    const entry = await this.prisma.timeEntry.create({ data: { taskId, userId, startedAt: new Date() }, include: { task: taskBrief } });
    this.emit(task.project.workspaceId, task.projectId, taskId, userId, 'timer.started');
    return entry;
  }

  async stop(userId: string) {
    const running = await this.prisma.timeEntry.findFirst({ where: { userId, endedAt: null }, include: { task: taskBrief } });
    if (!running) return null;
    const endedAt = new Date();
    const entry = await this.prisma.timeEntry.update({
      where: { id: running.id },
      data: { endedAt, minutes: minutesBetween(running.startedAt, endedAt) },
      include: { task: taskBrief },
    });
    this.emit(running.task.project.workspaceId, running.task.projectId, running.taskId, userId, 'time.logged', { minutes: entry.minutes });
    return entry;
  }

  async log(taskId: string, userId: string, dto: LogTimeDto) {
    const task = await this.access.task(taskId, userId, 'MEMBER');
    const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date(Date.now() - dto.minutes * 60000);
    if (startedAt > new Date()) throw new BadRequestException('Cannot log time in the future');
    const entry = await this.prisma.timeEntry.create({
      data: {
        taskId,
        userId,
        startedAt,
        endedAt: new Date(startedAt.getTime() + dto.minutes * 60000),
        minutes: dto.minutes,
        note: dto.note,
        billable: dto.billable ?? false,
      },
      include: { user: userBrief },
    });
    this.emit(task.project.workspaceId, task.projectId, taskId, userId, 'time.logged', { minutes: dto.minutes });
    return entry;
  }

  async forTask(taskId: string, userId: string) {
    await this.access.task(taskId, userId);
    const entries = await this.prisma.timeEntry.findMany({ where: { taskId }, include: { user: userBrief }, orderBy: { startedAt: 'desc' } });
    const now = new Date();
    const total = entries.reduce((sum, e) => sum + (e.minutes ?? minutesBetween(e.startedAt, now)), 0);
    return { total, entries };
  }

  async remove(entryId: string, userId: string) {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id: entryId }, include: { task: taskBrief } });
    if (!entry) throw new NotFoundException('Entry not found');
    if (entry.userId !== userId) {
      await this.access.membership(entry.task.project.workspaceId, userId, 'ADMIN').catch(() => {
        throw new ForbiddenException('Only the owner or an admin can delete this entry');
      });
    }
    await this.prisma.timeEntry.delete({ where: { id: entryId } });
  }

  /** Entries overlapping [from, to) with totals by day, user and project. */
  async timesheet(workspaceId: string, userId: string, q: TimesheetQuery) {
    await this.access.membership(workspaceId, userId);
    const from = new Date(q.from);
    const to = new Date(q.to);
    const entries = await this.prisma.timeEntry.findMany({
      where: { startedAt: { gte: from, lt: to }, userId: q.userId, task: { project: { workspaceId } } },
      include: { task: taskBrief, user: userBrief },
      orderBy: { startedAt: 'asc' },
    });
    const now = new Date();
    const totals = { byDay: {} as Record<string, number>, byUser: {} as Record<string, number>, byProject: {} as Record<string, number>, total: 0 };
    for (const e of entries) {
      const m = e.minutes ?? minutesBetween(e.startedAt, now);
      const day = new Date(e.startedAt);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString();
      totals.byDay[key] = (totals.byDay[key] ?? 0) + m;
      totals.byUser[e.userId] = (totals.byUser[e.userId] ?? 0) + m;
      totals.byProject[e.task.projectId] = (totals.byProject[e.task.projectId] ?? 0) + m;
      totals.total += m;
    }
    return { entries, totals };
  }

  private emit(workspaceId: string, projectId: string, taskId: string, actorId: string, action: string, diff?: Record<string, unknown>) {
    this.events.emit(Events.TaskUpdated, { workspaceId, projectId, taskId, actorId, action, diff } satisfies TaskEvent);
  }
}
