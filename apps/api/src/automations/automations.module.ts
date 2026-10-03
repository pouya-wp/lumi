import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CommentsModule } from '../comments/comments.module';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { TasksModule } from '../tasks/tasks.module';
import { AutomationDto, AutomationsService, UpdateAutomationDto } from './automations.service';

class TestDto {
  @IsString() taskId!: string;
}

@Controller()
class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get('projects/:projectId/automations')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.automations.list(projectId, user.id);
  }

  @Post('projects/:projectId/automations')
  create(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Body() dto: AutomationDto) {
    return this.automations.create(projectId, user.id, dto);
  }

  @Patch('automations/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateAutomationDto) {
    return this.automations.update(id, user.id, dto);
  }

  @Delete('automations/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.automations.remove(id, user.id);
  }

  @Get('automations/:id/runs')
  runs(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.automations.runs(id, user.id);
  }

  @Post('automations/:id/test') @HttpCode(200)
  test(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: TestDto) {
    return this.automations.test(id, user.id, dto.taskId);
  }
}

@Module({ imports: [TasksModule, CommentsModule], controllers: [AutomationsController], providers: [AutomationsService], exports: [AutomationsService] })
export class AutomationsModule {}
