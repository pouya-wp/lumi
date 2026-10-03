import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const VIEW_TYPES = ['LIST', 'BOARD', 'TABLE', 'CALENDAR', 'TIMELINE'] as const;

class CreateViewDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsIn(VIEW_TYPES) type!: (typeof VIEW_TYPES)[number];
  /** { filters: { assigneeIds, priorities, labelIds, statusIds, due }, sort: { field, dir }, groupBy } */
  @IsObject() config!: Record<string, unknown>;
  @IsOptional() @IsBoolean() shared?: boolean;
}

class UpdateViewDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
  @IsOptional() @IsBoolean() shared?: boolean;
}

@Injectable()
class ViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(projectId: string, userId: string) {
    await this.access.project(projectId, userId);
    return this.prisma.savedView.findMany({
      where: { projectId, OR: [{ ownerId: userId }, { shared: true }] },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(projectId: string, userId: string, dto: CreateViewDto) {
    await this.access.project(projectId, userId);
    return this.prisma.savedView.create({
      data: { projectId, ownerId: userId, name: dto.name, type: dto.type, config: dto.config as Prisma.InputJsonValue, shared: dto.shared ?? false },
    });
  }

  async update(id: string, userId: string, dto: UpdateViewDto) {
    await this.owned(id, userId);
    return this.prisma.savedView.update({
      where: { id },
      data: { name: dto.name, shared: dto.shared, config: dto.config as Prisma.InputJsonValue | undefined },
    });
  }

  async remove(id: string, userId: string) {
    await this.owned(id, userId);
    await this.prisma.savedView.delete({ where: { id } });
  }

  private async owned(id: string, userId: string) {
    const view = await this.prisma.savedView.findUnique({ where: { id } });
    if (!view) throw new NotFoundException('View not found');
    if (view.ownerId !== userId) throw new ForbiddenException('Only the owner can change this view');
    return view;
  }
}

@Controller()
class ViewsController {
  constructor(private readonly views: ViewsService) {}

  @Get('projects/:projectId/views')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.views.list(projectId, user.id);
  }

  @Post('projects/:projectId/views')
  create(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Body() dto: CreateViewDto) {
    return this.views.create(projectId, user.id, dto);
  }

  @Patch('views/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateViewDto) {
    return this.views.update(id, user.id, dto);
  }

  @Delete('views/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.views.remove(id, user.id);
  }
}

@Module({ controllers: [ViewsController], providers: [ViewsService] })
export class ViewsModule {}
