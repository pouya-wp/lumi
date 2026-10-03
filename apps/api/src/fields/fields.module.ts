import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { CreateFieldDto, FieldsService, UpdateFieldDto } from './fields.service';

@Controller()
class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Get('projects/:projectId/fields')
  list(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string) {
    return this.fields.list(projectId, user.id);
  }

  @Post('projects/:projectId/fields')
  create(@CurrentUser() user: AuthUser, @Param('projectId') projectId: string, @Body() dto: CreateFieldDto) {
    return this.fields.create(projectId, user.id, dto);
  }

  @Patch('fields/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateFieldDto) {
    return this.fields.update(id, user.id, dto);
  }

  @Delete('fields/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.fields.remove(id, user.id);
  }
}

@Module({ controllers: [FieldsController], providers: [FieldsService], exports: [FieldsService] })
export class FieldsModule {}
