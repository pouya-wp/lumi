import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
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
  SetLabelsDto,
  UpdateTaskDto,
} from './tasks.dto';
import { TasksService } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('projects/:projectId/tasks')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Query() q: ListTasksQuery) {
    return this.tasks.list(projectId, user.id, q);
  }

  @Post('projects/:projectId/tasks')
  create(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(projectId, user.id, dto);
  }

  @Get('me/tasks')
  myTasks(@CurrentUser() user: AuthUser, @Query() q: MyTasksQuery) {
    return this.tasks.myTasks(user.id, q);
  }

  @Get('workspaces/:workspaceId/tasks')
  range(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Query() q: RangeTasksQuery) {
    return this.tasks.range(workspaceId, user.id, q);
  }

  @Get('workspaces/:workspaceId/search')
  search(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string, @Query('q') q = '') {
    return this.tasks.search(workspaceId, user.id, q);
  }

  @Get('tasks/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.get(id, user.id);
  }

  @Patch('tasks/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(id, user.id, dto);
  }

  @Delete('tasks/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.remove(id, user.id);
  }

  @Post('tasks/:id/move') @HttpCode(200)
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveTaskDto) {
    return this.tasks.move(id, user.id, dto);
  }

  @Put('tasks/:id/assignees')
  setAssignees(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetAssigneesDto) {
    return this.tasks.setAssignees(id, user.id, dto);
  }

  @Put('tasks/:id/labels')
  setLabels(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetLabelsDto) {
    return this.tasks.setLabels(id, user.id, dto.labelIds);
  }

  @Post('tasks/:id/proposal') @HttpCode(200)
  respond(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProposalDto) {
    return this.tasks.respondToProposal(id, user.id, dto);
  }

  @Get('tasks/:id/activity')
  activity(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.activity(id, user.id);
  }

  @Post('tasks/:id/checklist')
  addChecklistItem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChecklistCreateDto) {
    return this.tasks.addChecklistItem(id, user.id, dto);
  }

  @Patch('checklist/:itemId')
  updateChecklistItem(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string, @Body() dto: ChecklistUpdateDto) {
    return this.tasks.updateChecklistItem(itemId, user.id, dto);
  }

  @Delete('checklist/:itemId') @HttpCode(204)
  removeChecklistItem(@CurrentUser() user: AuthUser, @Param('itemId') itemId: string) {
    return this.tasks.removeChecklistItem(itemId, user.id);
  }

  @Post('tasks/:id/dependencies') @HttpCode(204)
  addDependency(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DependencyDto) {
    return this.tasks.addDependency(id, user.id, dto);
  }

  @Delete('tasks/:id/dependencies') @HttpCode(204)
  removeDependency(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() dto: DependencyDto) {
    return this.tasks.removeDependency(id, user.id, dto.toTaskId, dto.type);
  }
}
