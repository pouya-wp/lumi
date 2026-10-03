import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Put } from '@nestjs/common';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class CreateMilestoneDto {
  @IsString() @MinLength(1) @MaxLength(120) title!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsDateString() dueAt!: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}

class UpdateMilestoneDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsBoolean() done?: boolean;
}

class LinkDto {
  @IsArray() @IsString({ each: true }) taskIds!: string[];
}

@Injectable()
class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private withProgress<T extends { tasks: { completedAt: Date | null }[] }>(m: T) {
    const { tasks, ...rest } = m;
    return { ...rest, total: tasks.length, done: tasks.filter((t) => t.completedAt).length };
  }

  async list(projectId: string, userId: string) {
    await this.access.project(projectId, userId);
    const items = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueAt: 'asc' },
      include: { tasks: { where: { deletedAt: null }, select: { completedAt: true } } },
    });
    return items.map((m) => this.withProgress(m));
  }

  /** All milestones across the workspace's active projects. */
  async roadmap(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    const items = await this.prisma.milestone.findMany({
      where: { project: { workspaceId, archivedAt: null } },
      orderBy: { dueAt: 'asc' },
      include: {
        project: { select: { id: true, name: true, icon: true, color: true, key: true } },
        tasks: { where: { deletedAt: null }, select: { completedAt: true } },
      },
    });
    return items.map((m) => this.withProgress(m));
  }

  async create(projectId: string, userId: string, dto: CreateMilestoneDto) {
    await this.access.project(projectId, userId, 'MEMBER');
    return this.prisma.milestone.create({ data: { projectId, title: dto.title, description: dto.description, dueAt: new Date(dto.dueAt), color: dto.color } });
  }

  async update(id: string, userId: string, dto: UpdateMilestoneDto) {
    const m = await this.find(id);
    await this.access.project(m.projectId, userId, 'MEMBER');
    const { done, dueAt, ...rest } = dto;
    return this.prisma.milestone.update({
      where: { id },
      data: { ...rest, dueAt: dueAt ? new Date(dueAt) : undefined, doneAt: done === undefined ? undefined : done ? new Date() : null },
    });
  }

  async remove(id: string, userId: string) {
    const m = await this.find(id);
    await this.access.project(m.projectId, userId, 'MEMBER');
    await this.prisma.milestone.delete({ where: { id } });
  }

  async link(id: string, userId: string, dto: LinkDto) {
    const m = await this.find(id);
    await this.access.project(m.projectId, userId, 'MEMBER');
    const count = await this.prisma.task.count({ where: { id: { in: dto.taskIds }, projectId: m.projectId } });
    if (count !== new Set(dto.taskIds).size) throw new BadRequestException('Tasks must belong to the milestone project');
    await this.prisma.$transaction([
      this.prisma.task.updateMany({ where: { milestoneId: id, id: { notIn: dto.taskIds } }, data: { milestoneId: null } }),
      this.prisma.task.updateMany({ where: { id: { in: dto.taskIds } }, data: { milestoneId: id } }),
    ]);
  }

  private async find(id: string) {
    const m = await this.prisma.milestone.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Milestone not found');
    return m;
  }
}

@Controller()
class MilestonesController {
  constructor(private readonly milestones: MilestonesService) {}

  @Get('projects/:id/milestones')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.milestones.list(id, user.id);
  }

  @Get('workspaces/:id/roadmap')
  roadmap(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.milestones.roadmap(id, user.id);
  }

  @Post('projects/:id/milestones')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateMilestoneDto) {
    return this.milestones.create(id, user.id, dto);
  }

  @Patch('milestones/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateMilestoneDto) {
    return this.milestones.update(id, user.id, dto);
  }

  @Delete('milestones/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.milestones.remove(id, user.id);
  }

  @Put('milestones/:id/tasks') @HttpCode(204)
  link(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LinkDto) {
    return this.milestones.link(id, user.id, dto);
  }
}

@Module({ controllers: [MilestonesController], providers: [MilestonesService] })
export class MilestonesModule {}
