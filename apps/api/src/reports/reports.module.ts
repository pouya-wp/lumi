import { Controller, Get, Header, Module, Param, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { GamificationService } from './gamification.service';
import { ReportsService } from './reports.service';

@Controller('workspaces/:id')
class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly game: GamificationService,
  ) {}

  @Get('reports')
  report(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string, @Query('projectId') projectId?: string) {
    return this.reports.report(id, user.id, { from, to, projectId });
  }

  @Get('export/tasks.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="lumi-tasks.csv"')
  exportCsv(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.reports.exportCsv(id, user.id, projectId);
  }

  @Get('gamification')
  gamification(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.game.board(id, user.id);
  }
}

@Module({ controllers: [ReportsController], providers: [ReportsService, GamificationService] })
export class ReportsModule {}
