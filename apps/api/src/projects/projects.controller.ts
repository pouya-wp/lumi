import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, CreateStatusDto, UpdateProjectDto, UpdateStatusDto } from './projects.dto';
import { ProjectsService } from './projects.service';

@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('workspaces/:workspaceId/projects')
  list(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.projects.list(workspaceId, user.id);
  }

  @Post('workspaces/:workspaceId/projects')
  async create(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Body() dto: CreateProjectDto) {
    const { locale } = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { locale: true } });
    return this.projects.create(workspaceId, user.id, dto, locale);
  }

  @Get('projects/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.get(id, user.id);
  }

  @Patch('projects/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, user.id, dto);
  }

  @Delete('projects/:id') @HttpCode(204)
  archive(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.archive(id, user.id);
  }

  @Post('projects/:id/statuses')
  createStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateStatusDto) {
    return this.projects.createStatus(id, user.id, dto);
  }

  @Patch('statuses/:id')
  updateStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.projects.updateStatus(id, user.id, dto);
  }

  @Delete('statuses/:id') @HttpCode(204)
  deleteStatus(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('moveTo') moveTo?: string) {
    return this.projects.deleteStatus(id, user.id, moveTo);
  }
}
