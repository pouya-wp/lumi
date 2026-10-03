import { Body, Controller, Delete, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { LogTimeDto, TimeService, TimesheetQuery } from './time.service';

@Controller()
class TimeController {
  constructor(private readonly time: TimeService) {}

  @Get('me/timer')
  running(@CurrentUser() user: AuthUser) {
    return this.time.running(user.id);
  }

  @Post('tasks/:id/timer/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.time.start(id, user.id);
  }

  @Post('me/timer/stop') @HttpCode(200)
  stop(@CurrentUser() user: AuthUser) {
    return this.time.stop(user.id);
  }

  @Post('tasks/:id/time')
  log(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LogTimeDto) {
    return this.time.log(id, user.id, dto);
  }

  @Get('tasks/:id/time')
  forTask(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.time.forTask(id, user.id);
  }

  @Delete('time/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.time.remove(id, user.id);
  }

  @Get('workspaces/:id/timesheet')
  timesheet(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query() q: TimesheetQuery) {
    return this.time.timesheet(id, user.id, q);
  }
}

@Module({ controllers: [TimeController], providers: [TimeService], exports: [TimeService] })
export class TimeModule {}
