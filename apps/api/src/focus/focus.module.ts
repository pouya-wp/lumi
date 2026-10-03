import { Body, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common';
import type { FocusKind } from '@prisma/client';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class StartFocusDto {
  @IsOptional() @IsString() taskId?: string;
  @IsInt() @Min(1) @Max(180) minutes!: number;
  @IsOptional() @IsIn(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']) kind?: FocusKind;
}

class FinishFocusDto {
  @IsBoolean() completed!: boolean;
}

@Injectable()
class FocusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async start(userId: string, dto: StartFocusDto) {
    if (dto.taskId) await this.access.task(dto.taskId, userId);
    await this.prisma.focusSession.updateMany({ where: { userId, endedAt: null }, data: { endedAt: new Date(), completed: false } });
    return this.prisma.focusSession.create({
      data: { userId, taskId: dto.taskId, plannedMin: dto.minutes, kind: dto.kind ?? 'FOCUS' },
      include: { task: { select: { id: true, title: true } } },
    });
  }

  /** Ends a session; a completed focus session on a task also logs its time. */
  async finish(id: string, userId: string, dto: FinishFocusDto) {
    const session = await this.prisma.focusSession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException('Session not found');
    const endedAt = new Date();
    const updated = await this.prisma.focusSession.update({ where: { id }, data: { endedAt, completed: dto.completed } });
    if (dto.completed && session.kind === 'FOCUS' && session.taskId) {
      const minutes = Math.max(1, Math.min(session.plannedMin, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000)));
      await this.prisma.timeEntry.create({ data: { taskId: session.taskId, userId, startedAt: session.startedAt, endedAt, minutes, note: '🍅 Pomodoro' } });
    }
    return updated;
  }

  async stats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since = new Date(today);
    since.setDate(since.getDate() - 29);
    const [current, sessions] = await Promise.all([
      this.prisma.focusSession.findFirst({ where: { userId, endedAt: null }, include: { task: { select: { id: true, title: true } } } }),
      this.prisma.focusSession.findMany({ where: { userId, kind: 'FOCUS', completed: true, startedAt: { gte: since } }, select: { startedAt: true, plannedMin: true } }),
    ]);
    const byDay = new Map<string, { count: number; minutes: number }>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString();
      const v = byDay.get(key) ?? { count: 0, minutes: 0 };
      v.count++;
      v.minutes += s.plannedMin;
      byDay.set(key, v);
    }
    // Consecutive days with a completed session, ending today (or yesterday if today has none yet).
    let streak = 0;
    const d = new Date(today);
    if (!byDay.has(d.toISOString())) d.setDate(d.getDate() - 1);
    while (byDay.has(d.toISOString())) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    const todayStats = byDay.get(today.toISOString()) ?? { count: 0, minutes: 0 };
    return { current, today: todayStats, streak, days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })) };
  }
}

@Controller()
class FocusController {
  constructor(private readonly focus: FocusService) {}

  @Post('me/focus')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartFocusDto) {
    return this.focus.start(user.id, dto);
  }

  @Post('focus/:id/finish') @HttpCode(200)
  finish(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FinishFocusDto) {
    return this.focus.finish(id, user.id, dto);
  }

  @Get('me/focus')
  stats(@CurrentUser() user: AuthUser) {
    return this.focus.stats(user.id);
  }
}

@Module({ controllers: [FocusController], providers: [FocusService] })
export class FocusModule {}
