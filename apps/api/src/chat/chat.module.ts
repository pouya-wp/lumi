import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { IsString } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { TasksModule } from '../tasks/tasks.module';
import { ChatService, CreateChannelDto, EditMessageDto, ReactDto, SendMessageDto, ToTaskDto } from './chat.service';

class DirectDto {
  @IsString() userId!: string;
}

@Controller()
class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('workspaces/:id/channels')
  channels(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.channels(id, user.id);
  }

  @Post('workspaces/:id/channels')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateChannelDto) {
    return this.chat.createChannel(id, user.id, dto);
  }

  @Post('workspaces/:id/dm') @HttpCode(200)
  direct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: DirectDto) {
    return this.chat.direct(id, user.id, dto.userId);
  }

  @Get('channels/:id/messages')
  messages(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('before') before?: string) {
    return this.chat.messages(id, user.id, before);
  }

  @Post('channels/:id/messages')
  send(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chat.send(id, user.id, dto);
  }

  @Post('channels/:id/read') @HttpCode(204)
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.markRead(id, user.id);
  }

  @Get('messages/:id/thread')
  thread(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.thread(id, user.id);
  }

  @Patch('messages/:id')
  edit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EditMessageDto) {
    return this.chat.edit(id, user.id, dto);
  }

  @Delete('messages/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.remove(id, user.id);
  }

  @Post('messages/:id/react') @HttpCode(200)
  react(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReactDto) {
    return this.chat.react(id, user.id, dto.emoji);
  }

  @Post('messages/:id/to-task')
  toTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ToTaskDto) {
    return this.chat.toTask(id, user.id, dto);
  }
}

@Module({ imports: [TasksModule], controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
