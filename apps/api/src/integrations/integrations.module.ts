import { Controller, Get, Injectable, Module, Param } from '@nestjs/common';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { CommentsModule } from '../comments/comments.module';
import { PrismaService } from '../prisma/prisma.service';
import { TasksModule } from '../tasks/tasks.module';
import { ApiKeyGuard, ApiKeysController, ApiKeysService, PublicApiController } from './api-keys';
import { CsvImportController, CsvImportService } from './csv-import';
import { GithubController, GithubService } from './github';
import { IcalController, IcalService } from './ical';
import { TelegramController, TelegramService } from './telegram';
import { WEBHOOK_EVENTS, WebhooksController, WebhooksService } from './webhooks';

/** Connection status for the settings page; secrets are only shown to admins. */
@Injectable()
class IntegrationsOverview {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly github: GithubService,
  ) {}

  async get(workspaceId: string, userId: string) {
    const m = await this.access.membership(workspaceId, userId);
    const admin = m.role === 'ADMIN' || m.role === 'OWNER';
    const [rows, link] = await Promise.all([
      this.prisma.integration.findMany({ where: { workspaceId } }),
      this.prisma.telegramLink.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } }),
    ]);
    const gh = rows.find((r) => r.kind === 'github')?.config as { secret?: string } | undefined;
    const tg = rows.find((r) => r.kind === 'telegram')?.config as { username?: string; defaultProjectId?: string } | undefined;
    return {
      admin,
      webhookEvents: WEBHOOK_EVENTS,
      github: gh ? { connected: true, webhookUrl: this.github.webhookUrl(workspaceId), secret: admin ? gh.secret : undefined } : { connected: false },
      telegram: tg ? { connected: true, username: tg.username, defaultProjectId: tg.defaultProjectId, linked: !!link?.chatId } : { connected: false, linked: false },
    };
  }
}

@Controller()
class IntegrationsController {
  constructor(private readonly overview: IntegrationsOverview) {}

  @Get('workspaces/:id/integrations')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.overview.get(id, user.id);
  }
}

@Module({
  imports: [TasksModule, CommentsModule],
  controllers: [IntegrationsController, ApiKeysController, PublicApiController, WebhooksController, GithubController, TelegramController, IcalController, CsvImportController],
  providers: [IntegrationsOverview, ApiKeysService, ApiKeyGuard, WebhooksService, GithubService, TelegramService, IcalService, CsvImportService],
})
export class IntegrationsModule {}
