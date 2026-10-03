import { BadRequestException, Controller, Delete, Headers, HttpCode, Injectable, Logger, NotFoundException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { AccessService } from '../common/access.service';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { CommentsService } from '../comments/comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { hmacSha256, publicApiUrl, safeEqual, token } from './crypto';
import { closesWork, extractKeys, findTasksByKeys } from './task-keys';

interface GithubConfig {
  secret: string;
  userId: string;
}

interface Commit {
  id: string;
  message: string;
  url: string;
  author?: { name?: string };
}

/**
 * GitHub webhook receiver: commits and pull requests that mention task keys (APP-12) get linked
 * as comments; "fixes APP-12" on the default branch or a merged PR moves the task to done,
 * an opened PR moves it to review.
 */
@Injectable()
export class GithubService {
  private readonly log = new Logger('GitHub');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
  ) {}

  webhookUrl(workspaceId: string) {
    return `${publicApiUrl()}/api/integrations/github/${workspaceId}`;
  }

  async connect(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    const config: GithubConfig = { secret: token('gh_', 24), userId };
    await this.prisma.integration.upsert({
      where: { workspaceId_kind: { workspaceId, kind: 'github' } },
      create: { workspaceId, kind: 'github', config: { ...config } },
      update: { config: { ...config } },
    });
    return { webhookUrl: this.webhookUrl(workspaceId), secret: config.secret };
  }

  async disconnect(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    await this.prisma.integration.deleteMany({ where: { workspaceId, kind: 'github' } });
  }

  async receive(workspaceId: string, event: string | undefined, signature: string | undefined, raw: Buffer | undefined, body: Record<string, unknown>) {
    const integration = await this.prisma.integration.findUnique({ where: { workspaceId_kind: { workspaceId, kind: 'github' } } });
    if (!integration) throw new NotFoundException('GitHub is not connected');
    const config = integration.config as unknown as GithubConfig;
    if (!raw || !signature || !safeEqual(signature, `sha256=${hmacSha256(config.secret, raw)}`)) throw new UnauthorizedException('Bad signature');

    if (event === 'ping') return { ok: true };
    if (event === 'push') return this.onPush(workspaceId, config.userId, body);
    if (event === 'pull_request') return this.onPullRequest(workspaceId, config.userId, body);
    return { ignored: event };
  }

  private async statusId(projectId: string, category: 'DONE' | 'REVIEW') {
    const statuses = await this.prisma.status.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
    return statuses.find((s) => s.category === category)?.id;
  }

  private async onPush(workspaceId: string, userId: string, body: Record<string, unknown>) {
    const repo = (body.repository as { full_name?: string; default_branch?: string }) ?? {};
    const branch = String(body.ref ?? '').replace('refs/heads/', '');
    const onDefault = branch === repo.default_branch;
    let linked = 0;
    for (const c of (body.commits as Commit[] | undefined) ?? []) {
      for (const t of await findTasksByKeys(this.prisma, workspaceId, extractKeys(c.message))) {
        const first = c.message.split('\n')[0];
        await this.comments.create(t.id, userId, { text: `🔗 commit [${c.id.slice(0, 7)}](${c.url}) · ${repo.full_name ?? ''}@${branch}\n${c.author?.name ?? ''}: ${first}` });
        if (onDefault && closesWork(c.message)) {
          const done = await this.statusId(t.projectId, 'DONE');
          if (done) await this.tasks.update(t.id, userId, { statusId: done });
        }
        linked++;
      }
    }
    return { linked };
  }

  private async onPullRequest(workspaceId: string, userId: string, body: Record<string, unknown>) {
    const pr = body.pull_request as { title?: string; body?: string; html_url?: string; number?: number; merged?: boolean; user?: { login?: string } } | undefined;
    if (!pr) throw new BadRequestException('Missing pull_request');
    const action = body.action as string;
    const text = `${pr.title ?? ''}\n${pr.body ?? ''}`;
    const targets = await findTasksByKeys(this.prisma, workspaceId, extractKeys(text));
    for (const t of targets) {
      if (action === 'opened' || action === 'reopened') {
        await this.comments.create(t.id, userId, { text: `🔀 PR #${pr.number} opened by ${pr.user?.login ?? '?'}: [${pr.title}](${pr.html_url})` });
        const review = await this.statusId(t.projectId, 'REVIEW');
        if (review) await this.tasks.update(t.id, userId, { statusId: review });
      } else if (action === 'closed' && pr.merged) {
        await this.comments.create(t.id, userId, { text: `✅ PR #${pr.number} merged: [${pr.title}](${pr.html_url})` });
        const done = await this.statusId(t.projectId, 'DONE');
        if (done) await this.tasks.update(t.id, userId, { statusId: done });
      }
    }
    this.log.log(`PR #${pr.number} ${action}: ${targets.length} task(s)`);
    return { linked: targets.length };
  }
}

@Controller()
export class GithubController {
  constructor(private readonly github: GithubService) {}

  @Post('workspaces/:id/integrations/github')
  connect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.github.connect(id, user.id);
  }

  @Delete('workspaces/:id/integrations/github') @HttpCode(204)
  disconnect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.github.disconnect(id, user.id);
  }

  @Public()
  @Post('integrations/github/:workspaceId') @HttpCode(200)
  receive(
    @Param('workspaceId') workspaceId: string,
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: RawBodyRequest<{ body: unknown }>,
  ) {
    return this.github.receive(workspaceId, event, signature, req.rawBody, req.body as Record<string, unknown>);
  }
}
