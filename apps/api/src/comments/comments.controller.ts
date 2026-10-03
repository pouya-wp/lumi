import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { CommentsService, CreateCommentDto, UpdateCommentDto } from './comments.service';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('tasks/:taskId/comments')
  list(@CurrentUser() user: AuthUser, @Param('taskId') taskId: string) {
    return this.comments.list(taskId, user.id);
  }

  @Post('tasks/:taskId/comments')
  create(@CurrentUser() user: AuthUser, @Param('taskId') taskId: string, @Body() dto: CreateCommentDto) {
    return this.comments.create(taskId, user.id, dto);
  }

  @Patch('comments/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCommentDto) {
    return this.comments.update(id, user.id, dto);
  }

  @Delete('comments/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.comments.remove(id, user.id);
  }
}
