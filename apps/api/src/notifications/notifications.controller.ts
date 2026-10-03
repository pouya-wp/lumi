import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { IsDateString } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { NotificationsService } from './notifications.service';

class SnoozeDto {
  @IsDateString() until!: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('unread') unread?: string) {
    return this.notifications.list(user.id, unread === 'true');
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post('read-all') @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read') @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post(':id/snooze') @HttpCode(204)
  snooze(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SnoozeDto) {
    return this.notifications.snooze(user.id, id, new Date(dto.until));
  }
}
