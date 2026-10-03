import { Controller, Get, Module, Param } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@Controller('workspaces/:workspaceId/dashboard')
class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
    return this.dashboard.get(workspaceId, user.id);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
