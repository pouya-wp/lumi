import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Put, Query } from '@nestjs/common';
import type { KeyResultType } from '@prisma/client';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const KR_TYPES = ['NUMBER', 'PERCENT', 'CURRENCY', 'TASKS'] as const;

class CreateGoalDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsString() @MaxLength(20) period!: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() parentId?: string;
}

class UpdateGoalDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsString() @MaxLength(20) period?: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsString() ownerId?: string;
}

class CreateKrDto {
  @IsString() @MinLength(2) @MaxLength(200) title!: string;
  @IsIn(KR_TYPES) type!: KeyResultType;
  @IsOptional() @IsNumber() start?: number;
  @IsOptional() @IsNumber() target?: number;
  @IsOptional() @IsString() @MaxLength(16) unit?: string;
}

class UpdateKrDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(200) title?: string;
  @IsOptional() @IsNumber() start?: number;
  @IsOptional() @IsNumber() target?: number;
  @IsOptional() @IsString() @MaxLength(16) unit?: string;
}

class CheckInDto {
  @IsNumber() value!: number;
  @IsInt() @Min(1) @Max(10) confidence!: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class LinkTasksDto {
  @IsArray() @IsString({ each: true }) taskIds!: string[];
}

const userBrief = { select: { id: true, name: true, avatarUrl: true } } as const;

type KrWithData = {
  type: KeyResultType;
  start: number;
  target: number;
  current: number;
  tasks: { task: { completedAt: Date | null; deletedAt: Date | null } }[];
  checkIns: { confidence: number }[];
};

/** 0–100 progress of a key result; TASKS uses the share of linked tasks completed. */
export function krProgress(kr: KrWithData) {
  if (kr.type === 'TASKS') {
    const tasks = kr.tasks.filter((t) => !t.task.deletedAt);
    return tasks.length ? Math.round((tasks.filter((t) => t.task.completedAt).length / tasks.length) * 100) : 0;
  }
  const span = kr.target - kr.start;
  if (span === 0) return kr.current >= kr.target ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((kr.current - kr.start) / span) * 100)));
}

/** Status from the latest confidence (or progress vs elapsed time when nobody checked in). */
function status(progress: number, confidence: number | undefined) {
  if (confidence !== undefined) return confidence >= 7 ? 'ON_TRACK' : confidence >= 4 ? 'AT_RISK' : 'OFF_TRACK';
  return progress >= 70 ? 'ON_TRACK' : progress >= 35 ? 'AT_RISK' : 'OFF_TRACK';
}

@Injectable()
class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(workspaceId: string, userId: string, period?: string) {
    await this.access.membership(workspaceId, userId);
    const goals = await this.prisma.goal.findMany({
      where: { workspaceId, period },
      orderBy: { createdAt: 'asc' },
      include: {
        owner: userBrief,
        keyResults: {
          orderBy: { order: 'asc' },
          include: {
            tasks: { include: { task: { select: { id: true, title: true, number: true, completedAt: true, deletedAt: true, project: { select: { key: true } } } } } },
            checkIns: { orderBy: { createdAt: 'desc' }, take: 5, include: { user: userBrief } },
          },
        },
      },
    });
    const periods = await this.prisma.goal.findMany({ where: { workspaceId }, distinct: ['period'], select: { period: true }, orderBy: { period: 'desc' } });
    return {
      periods: periods.map((p) => p.period),
      goals: goals.map((g) => {
        const keyResults = g.keyResults.map((kr) => {
          const progress = krProgress(kr);
          return {
            ...kr,
            tasks: kr.tasks.filter((t) => !t.task.deletedAt).map((t) => ({ ...t.task, key: `${t.task.project.key}-${t.task.number}` })),
            progress,
            status: status(progress, kr.checkIns[0]?.confidence),
          };
        });
        const progress = keyResults.length ? Math.round(keyResults.reduce((a, k) => a + k.progress, 0) / keyResults.length) : 0;
        const worst = keyResults.some((k) => k.status === 'OFF_TRACK') ? 'OFF_TRACK' : keyResults.some((k) => k.status === 'AT_RISK') ? 'AT_RISK' : 'ON_TRACK';
        return { ...g, keyResults, progress, status: keyResults.length ? worst : 'ON_TRACK' };
      }),
    };
  }

  async create(workspaceId: string, userId: string, dto: CreateGoalDto) {
    await this.access.membership(workspaceId, userId, 'MEMBER');
    if (dto.ownerId) await this.access.membership(workspaceId, dto.ownerId);
    return this.prisma.goal.create({
      data: { workspaceId, ownerId: dto.ownerId ?? userId, title: dto.title, description: dto.description, period: dto.period, emoji: dto.emoji, parentId: dto.parentId },
    });
  }

  async update(id: string, userId: string, dto: UpdateGoalDto) {
    const goal = await this.findGoal(id);
    await this.access.membership(goal.workspaceId, userId, 'MEMBER');
    return this.prisma.goal.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const goal = await this.findGoal(id);
    const m = await this.access.membership(goal.workspaceId, userId, 'MEMBER');
    if (goal.ownerId !== userId && m.role !== 'ADMIN' && m.role !== 'OWNER') throw new ForbiddenException('Only the owner or an admin can delete');
    await this.prisma.goal.delete({ where: { id } });
  }

  async addKr(goalId: string, userId: string, dto: CreateKrDto) {
    const goal = await this.findGoal(goalId);
    await this.access.membership(goal.workspaceId, userId, 'MEMBER');
    if (dto.type !== 'TASKS' && dto.target === undefined) throw new BadRequestException('Target is required');
    const count = await this.prisma.keyResult.count({ where: { goalId } });
    const start = dto.start ?? 0;
    return this.prisma.keyResult.create({
      data: { goalId, title: dto.title, type: dto.type, start, current: start, target: dto.type === 'TASKS' ? 100 : dto.target!, unit: dto.unit, order: count },
    });
  }

  async updateKr(id: string, userId: string, dto: UpdateKrDto) {
    const kr = await this.findKr(id);
    await this.access.membership(kr.goal.workspaceId, userId, 'MEMBER');
    return this.prisma.keyResult.update({ where: { id }, data: dto });
  }

  async removeKr(id: string, userId: string) {
    const kr = await this.findKr(id);
    await this.access.membership(kr.goal.workspaceId, userId, 'MEMBER');
    await this.prisma.keyResult.delete({ where: { id } });
  }

  async checkIn(id: string, userId: string, dto: CheckInDto) {
    const kr = await this.findKr(id);
    await this.access.membership(kr.goal.workspaceId, userId, 'MEMBER');
    const [checkIn] = await this.prisma.$transaction([
      this.prisma.checkIn.create({ data: { keyResultId: id, userId, value: dto.value, confidence: dto.confidence, note: dto.note } }),
      this.prisma.keyResult.update({ where: { id }, data: kr.type === 'TASKS' ? {} : { current: dto.value } }),
    ]);
    return checkIn;
  }

  async linkTasks(id: string, userId: string, dto: LinkTasksDto) {
    const kr = await this.findKr(id);
    await this.access.membership(kr.goal.workspaceId, userId, 'MEMBER');
    const valid = await this.prisma.task.count({ where: { id: { in: dto.taskIds }, project: { workspaceId: kr.goal.workspaceId } } });
    if (valid !== new Set(dto.taskIds).size) throw new BadRequestException('Tasks must belong to this workspace');
    await this.prisma.$transaction([
      this.prisma.keyResultTask.deleteMany({ where: { keyResultId: id } }),
      this.prisma.keyResultTask.createMany({ data: [...new Set(dto.taskIds)].map((taskId) => ({ keyResultId: id, taskId })) }),
    ]);
  }

  private async findGoal(id: string) {
    const goal = await this.prisma.goal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  private async findKr(id: string) {
    const kr = await this.prisma.keyResult.findUnique({ where: { id }, include: { goal: true } });
    if (!kr) throw new NotFoundException('Key result not found');
    return kr;
  }
}

@Controller()
class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('workspaces/:id/goals')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('period') period?: string) {
    return this.goals.list(id, user.id, period || undefined);
  }

  @Post('workspaces/:id/goals')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateGoalDto) {
    return this.goals.create(id, user.id, dto);
  }

  @Patch('goals/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(id, user.id, dto);
  }

  @Delete('goals/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.goals.remove(id, user.id);
  }

  @Post('goals/:id/key-results')
  addKr(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateKrDto) {
    return this.goals.addKr(id, user.id, dto);
  }

  @Patch('key-results/:id')
  updateKr(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateKrDto) {
    return this.goals.updateKr(id, user.id, dto);
  }

  @Delete('key-results/:id') @HttpCode(204)
  removeKr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.goals.removeKr(id, user.id);
  }

  @Post('key-results/:id/check-ins')
  checkIn(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CheckInDto) {
    return this.goals.checkIn(id, user.id, dto);
  }

  @Put('key-results/:id/tasks') @HttpCode(204)
  linkTasks(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LinkTasksDto) {
    return this.goals.linkTasks(id, user.id, dto);
  }
}

@Module({ controllers: [GoalsController], providers: [GoalsService] })
export class GoalsModule {}
