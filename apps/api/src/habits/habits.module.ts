import { Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

class CreateHabitDto {
  @IsString() workspaceId!: string;
  @IsString() @MinLength(1) @MaxLength(80) title!: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(7) @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) days?: number[];
}

class UpdateHabitDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsArray() @IsInt({ each: true }) days?: number[];
  @IsOptional() @IsBoolean() archived?: boolean;
}

class LogDto {
  /** Local day YYYY-MM-DD; toggles the log. */
  @Matches(DAY_RE) day!: string;
}

const toDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Consecutive due days completed, counting back from today (today may still be pending). */
export function streak(days: number[], logged: Set<string>, today = new Date()) {
  const due = (d: Date) => !days.length || days.includes(d.getDay());
  let count = 0;
  const d = new Date(today);
  if (due(d) && !logged.has(toDay(d))) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    if (due(d)) {
      if (!logged.has(toDay(d))) break;
      count++;
    }
    d.setDate(d.getDate() - 1);
  }
  return count;
}

@Injectable()
class HabitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(userId: string, workspaceId: string, today?: string) {
    await this.access.membership(workspaceId, userId);
    const since = new Date();
    since.setDate(since.getDate() - 120);
    const habits = await this.prisma.habit.findMany({
      where: { userId, workspaceId, archivedAt: null },
      include: { logs: { where: { day: { gte: toDay(since) } } } },
      orderBy: { createdAt: 'asc' },
    });
    const now = today && DAY_RE.test(today) ? new Date(`${today}T12:00:00`) : new Date();
    return habits.map(({ logs, ...h }) => {
      const set = new Set(logs.map((l) => l.day));
      let best = 0;
      let run = 0;
      for (let i = 120; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        if (h.days.length && !h.days.includes(d.getDay())) continue;
        run = set.has(toDay(d)) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      return { ...h, logs: [...set].sort(), streak: streak(h.days, set, now), best };
    });
  }

  async create(userId: string, dto: CreateHabitDto) {
    await this.access.membership(dto.workspaceId, userId);
    return this.prisma.habit.create({ data: { userId, workspaceId: dto.workspaceId, title: dto.title, emoji: dto.emoji, color: dto.color, days: dto.days ?? [] } });
  }

  async update(id: string, userId: string, dto: UpdateHabitDto) {
    await this.own(id, userId);
    const { archived, ...rest } = dto;
    return this.prisma.habit.update({ where: { id }, data: { ...rest, archivedAt: archived === undefined ? undefined : archived ? new Date() : null } });
  }

  async remove(id: string, userId: string) {
    await this.own(id, userId);
    await this.prisma.habit.delete({ where: { id } });
  }

  async toggle(id: string, userId: string, dto: LogDto) {
    await this.own(id, userId);
    const key = { habitId_day: { habitId: id, day: dto.day } };
    const existing = await this.prisma.habitLog.findUnique({ where: key });
    if (existing) await this.prisma.habitLog.delete({ where: key });
    else await this.prisma.habitLog.create({ data: { habitId: id, day: dto.day } });
    return { done: !existing };
  }

  private async own(id: string, userId: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id, userId } });
    if (!habit) throw new NotFoundException('Habit not found');
    return habit;
  }
}

@Controller()
class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get('me/habits')
  list(@CurrentUser() user: AuthUser, @Query('workspaceId') workspaceId: string, @Query('today') today?: string) {
    return this.habits.list(user.id, workspaceId, today);
  }

  @Post('me/habits')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHabitDto) {
    return this.habits.create(user.id, dto);
  }

  @Patch('habits/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateHabitDto) {
    return this.habits.update(id, user.id, dto);
  }

  @Delete('habits/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.habits.remove(id, user.id);
  }

  @Post('habits/:id/toggle') @HttpCode(200)
  toggle(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: LogDto) {
    return this.habits.toggle(id, user.id, dto);
  }
}

@Module({ controllers: [HabitsController], providers: [HabitsService] })
export class HabitsModule {}
