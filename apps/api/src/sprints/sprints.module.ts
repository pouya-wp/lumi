import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Delete } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { IsArray, IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { Events, type ProjectEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';

class CreateSprintDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
  @IsOptional() @IsString() @MaxLength(300) goal?: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
}

class UpdateSprintDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(300) goal?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsObject() retro?: { wentWell?: string[]; improve?: string[]; actions?: string[] };
}

class CompleteSprintDto {
  /** Where unfinished tasks go: the next planned sprint, or back to the backlog. */
  @IsIn(['next', 'backlog']) carryOver!: 'next' | 'backlog';
}

class AssignDto {
  @IsArray() @IsString({ each: true }) taskIds!: string[];
  /** Target sprint, or null for the backlog. */
  @IsOptional() @IsString() sprintId?: string | null;
}

const DAY = 86400000;
const points = (t: { storyPoints: number | null }) => t.storyPoints ?? 1;

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: EventEmitter2,
  ) {}

  async list(projectId: string, userId: string) {
    await this.access.project(projectId, userId);
    const sprints = await this.prisma.sprint.findMany({
      where: { projectId },
      orderBy: [{ startAt: 'asc' }],
      include: { tasks: { where: { deletedAt: null }, select: { storyPoints: true, completedAt: true } } },
    });
    return sprints.map(({ tasks, ...s }) => ({
      ...s,
      stats: {
        tasks: tasks.length,
        done: tasks.filter((t) => t.completedAt).length,
        points: tasks.reduce((a, t) => a + points(t), 0),
        donePoints: tasks.filter((t) => t.completedAt).reduce((a, t) => a + points(t), 0),
      },
    }));
  }

  async create(projectId: string, userId: string, dto: CreateSprintDto) {
    const project = await this.access.project(projectId, userId, 'MEMBER');
    if (new Date(dto.endAt) <= new Date(dto.startAt)) throw new BadRequestException('Sprint must end after it starts');
    const sprint = await this.prisma.sprint.create({ data: { projectId, name: dto.name, goal: dto.goal, startAt: new Date(dto.startAt), endAt: new Date(dto.endAt) } });
    this.emit(project.workspaceId, projectId, userId);
    return sprint;
  }

  async update(id: string, userId: string, dto: UpdateSprintDto) {
    const sprint = await this.find(id);
    const project = await this.access.project(sprint.projectId, userId, 'MEMBER');
    const updated = await this.prisma.sprint.update({
      where: { id },
      data: {
        name: dto.name,
        goal: dto.goal,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        retro: dto.retro as Prisma.InputJsonValue | undefined,
      },
    });
    this.emit(project.workspaceId, project.id, userId);
    return updated;
  }

  async remove(id: string, userId: string) {
    const sprint = await this.find(id);
    const project = await this.access.project(sprint.projectId, userId, 'MEMBER');
    if (sprint.state === 'ACTIVE') throw new BadRequestException('Complete the sprint before deleting it');
    await this.prisma.sprint.delete({ where: { id } });
    this.emit(project.workspaceId, project.id, userId);
  }

  async start(id: string, userId: string) {
    const sprint = await this.find(id);
    const project = await this.access.project(sprint.projectId, userId, 'MEMBER');
    if (sprint.state !== 'PLANNED') throw new BadRequestException('Only planned sprints can start');
    const active = await this.prisma.sprint.findFirst({ where: { projectId: sprint.projectId, state: 'ACTIVE' } });
    if (active) throw new BadRequestException('Another sprint is already active');
    const updated = await this.prisma.sprint.update({ where: { id }, data: { state: 'ACTIVE' } });
    this.emit(project.workspaceId, project.id, userId);
    return updated;
  }

  /** Freezes the summary, records velocity, and carries unfinished tasks over. */
  async complete(id: string, userId: string, dto: CompleteSprintDto) {
    const sprint = await this.find(id);
    const project = await this.access.project(sprint.projectId, userId, 'MEMBER');
    if (sprint.state !== 'ACTIVE') throw new BadRequestException('Only the active sprint can be completed');
    const tasks = await this.prisma.task.findMany({ where: { sprintId: id, deletedAt: null }, select: { id: true, storyPoints: true, completedAt: true } });
    const done = tasks.filter((t) => t.completedAt);
    const unfinished = tasks.filter((t) => !t.completedAt);
    const next =
      dto.carryOver === 'next'
        ? await this.prisma.sprint.findFirst({ where: { projectId: sprint.projectId, state: 'PLANNED', id: { not: id } }, orderBy: { startAt: 'asc' } })
        : null;
    const summary = {
      committedTasks: tasks.length,
      completedTasks: done.length,
      committedPoints: tasks.reduce((a, t) => a + points(t), 0),
      completedPoints: done.reduce((a, t) => a + points(t), 0),
      carriedOver: unfinished.length,
      carriedTo: next?.id ?? null,
    };
    await this.prisma.$transaction([
      this.prisma.task.updateMany({ where: { id: { in: unfinished.map((t) => t.id) } }, data: { sprintId: next?.id ?? null } }),
      this.prisma.sprint.update({ where: { id }, data: { state: 'COMPLETED', completedAt: new Date(), summary } }),
    ]);
    this.emit(project.workspaceId, project.id, userId);
    return { ...summary, nextSprint: next };
  }

  async assign(projectId: string, userId: string, dto: AssignDto) {
    const project = await this.access.project(projectId, userId, 'MEMBER');
    if (dto.sprintId) {
      const sprint = await this.find(dto.sprintId);
      if (sprint.projectId !== projectId || sprint.state === 'COMPLETED') throw new BadRequestException('Invalid sprint');
    }
    await this.prisma.task.updateMany({ where: { id: { in: dto.taskIds }, projectId }, data: { sprintId: dto.sprintId ?? null } });
    this.emit(project.workspaceId, projectId, userId);
  }

  /** Daily burndown (ideal vs actual remaining points) plus recent velocity. */
  async report(id: string, userId: string) {
    const sprint = await this.find(id);
    await this.access.project(sprint.projectId, userId);
    const tasks = await this.prisma.task.findMany({ where: { sprintId: id, deletedAt: null }, select: { storyPoints: true, completedAt: true } });
    const total = tasks.reduce((a, t) => a + points(t), 0);
    const start = new Date(sprint.startAt);
    start.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.ceil((sprint.endAt.getTime() - start.getTime()) / DAY));
    const today = new Date();
    const series = Array.from({ length: days + 1 }, (_, i) => {
      const end = new Date(start.getTime() + (i + 1) * DAY);
      const date = new Date(start.getTime() + i * DAY);
      const remaining = total - tasks.filter((t) => t.completedAt && t.completedAt < end).reduce((a, t) => a + points(t), 0);
      return { date: date.toISOString(), ideal: Math.max(0, total - (total * i) / days), actual: date <= today ? remaining : null };
    });
    const history = await this.prisma.sprint.findMany({
      where: { projectId: sprint.projectId, state: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 6,
      select: { id: true, name: true, summary: true },
    });
    const velocity = history.reverse().map((h) => ({ id: h.id, name: h.name, ...(h.summary as { committedPoints: number; completedPoints: number }) }));
    const avg = velocity.length ? velocity.reduce((a, v) => a + v.completedPoints, 0) / velocity.length : null;
    return { total, series, velocity, averageVelocity: avg };
  }

  private async find(id: string) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id } });
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  private emit(workspaceId: string, projectId: string, actorId: string) {
    this.events.emit(Events.ProjectChanged, { workspaceId, projectId, actorId } satisfies ProjectEvent);
  }
}

@Controller()
class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('projects/:projectId/sprints')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.sprints.list(projectId, user.id);
  }

  @Post('projects/:projectId/sprints')
  create(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Body() dto: CreateSprintDto) {
    return this.sprints.create(projectId, user.id, dto);
  }

  @Post('projects/:projectId/sprints/assign') @HttpCode(204)
  assign(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Body() dto: AssignDto) {
    return this.sprints.assign(projectId, user.id, dto);
  }

  @Patch('sprints/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateSprintDto) {
    return this.sprints.update(id, user.id, dto);
  }

  @Delete('sprints/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sprints.remove(id, user.id);
  }

  @Post('sprints/:id/start') @HttpCode(200)
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sprints.start(id, user.id);
  }

  @Post('sprints/:id/complete') @HttpCode(200)
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CompleteSprintDto) {
    return this.sprints.complete(id, user.id, dto);
  }

  @Get('sprints/:id/report')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sprints.report(id, user.id);
  }
}

@Module({ controllers: [SprintsController], providers: [SprintsService] })
export class SprintsModule {}
