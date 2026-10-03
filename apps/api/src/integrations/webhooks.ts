import { Body, Controller, Delete, Get, HttpCode, Injectable, Logger, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { ChatEvent, type ChatEventPayload } from '../chat/chat.service';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { Events, type CommentEvent, type TaskEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
import { hmacSha256, token } from './crypto';

export const WEBHOOK_EVENTS = ['task.created', 'task.updated', 'task.completed', 'task.deleted', 'comment.created', 'chat.message'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export class CreateWebhookDto {
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true }) url!: string;
  @IsArray() @ArrayMinSize(1) @IsIn(WEBHOOK_EVENTS, { each: true }) events!: WebhookEvent[];
}

export class UpdateWebhookDto {
  @IsOptional() @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true }) url?: string;
  @IsOptional() @IsArray() @IsIn(WEBHOOK_EVENTS, { each: true }) events?: WebhookEvent[];
  @IsOptional() @IsBoolean() active?: boolean;
}

const KEEP_DELIVERIES = 50;

/**
 * Signed outgoing webhooks. Each delivery is a JSON POST with
 * `X-Lumi-Event`, `X-Lumi-Delivery` and `X-Lumi-Signature: sha256=<hmac(secret, body)>`.
 */
@Injectable()
export class WebhooksService {
  private readonly log = new Logger('Webhooks');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    return this.prisma.webhook.findMany({
      where: { workspaceId },
      include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(workspaceId: string, userId: string, dto: CreateWebhookDto) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    return this.prisma.webhook.create({ data: { workspaceId, url: dto.url, events: [...new Set(dto.events)], secret: token('whsec_', 24), createdById: userId } });
  }

  private async own(id: string, userId: string) {
    const hook = await this.prisma.webhook.findUnique({ where: { id } });
    if (!hook) throw new NotFoundException('Webhook not found');
    await this.access.membership(hook.workspaceId, userId, 'ADMIN');
    return hook;
  }

  async update(id: string, userId: string, dto: UpdateWebhookDto) {
    await this.own(id, userId);
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.own(id, userId);
    await this.prisma.webhook.delete({ where: { id } });
  }

  async ping(id: string, userId: string) {
    const hook = await this.own(id, userId);
    return this.deliver(hook, 'ping' as WebhookEvent, { message: 'Hello from Lumi 👋' });
  }

  /** Sends to every active hook subscribed to `event` in the workspace; never throws. */
  async dispatch(workspaceId: string, event: WebhookEvent, data: Record<string, unknown>) {
    const hooks = await this.prisma.webhook.findMany({ where: { workspaceId, active: true, events: { has: event } } });
    await Promise.all(hooks.map((h) => this.deliver(h, event, data)));
  }

  private async deliver(hook: { id: string; url: string; secret: string; workspaceId: string }, event: WebhookEvent, data: Record<string, unknown>) {
    const id = randomUUID();
    const body = JSON.stringify({ id, event, workspaceId: hook.workspaceId, createdAt: new Date().toISOString(), data });
    const started = Date.now();
    let status: number | undefined;
    let error: string | undefined;
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Lumi-Webhooks/1',
          'X-Lumi-Event': event,
          'X-Lumi-Delivery': id,
          'X-Lumi-Signature': `sha256=${hmacSha256(hook.secret, body)}`,
        },
        body,
        signal: AbortSignal.timeout(8000),
      });
      status = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      this.log.warn(`Delivery to ${hook.url} failed: ${error}`);
    }
    const delivery = await this.prisma.webhookDelivery.create({
      data: { webhookId: hook.id, event, status, ok: !error, durationMs: Date.now() - started, error },
    });
    const old = await this.prisma.webhookDelivery.findMany({ where: { webhookId: hook.id }, orderBy: { createdAt: 'desc' }, skip: KEEP_DELIVERIES, select: { id: true } });
    if (old.length) await this.prisma.webhookDelivery.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return delivery;
  }

  private async taskPayload(taskId: string) {
    const t = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, key: true, name: true } },
        status: { select: { name: true, category: true } },
        assignees: { where: { role: 'ASSIGNEE' }, include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!t) return null;
    return {
      id: t.id,
      key: `${t.project.key}-${t.number}`,
      title: t.title,
      project: t.project,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
      completedAt: t.completedAt,
      assignees: t.assignees.map((a) => a.user),
    };
  }

  private fire(workspaceId: string, event: WebhookEvent, build: () => Promise<Record<string, unknown> | null>) {
    // Skip the lookup entirely when nobody listens, then deliver in the background.
    this.prisma.webhook
      .count({ where: { workspaceId, active: true, events: { has: event } } })
      .then(async (n) => {
        if (!n) return;
        const data = await build();
        if (data) await this.dispatch(workspaceId, event, data);
      })
      .catch((e) => this.log.error(e));
  }

  @OnEvent(Events.TaskCreated)
  onCreated(e: TaskEvent) {
    this.fire(e.workspaceId, 'task.created', async () => ({ task: await this.taskPayload(e.taskId), actorId: e.actorId }));
  }

  @OnEvent(Events.TaskUpdated)
  onUpdated(e: TaskEvent) {
    const completed = !!(e.diff?.completedAt as { to?: unknown } | undefined)?.to;
    this.fire(e.workspaceId, 'task.updated', async () => ({ task: await this.taskPayload(e.taskId), action: e.action, changes: e.diff ?? {}, actorId: e.actorId }));
    if (completed) this.fire(e.workspaceId, 'task.completed', async () => ({ task: await this.taskPayload(e.taskId), actorId: e.actorId }));
  }

  @OnEvent(Events.TaskDeleted)
  onDeleted(e: TaskEvent) {
    this.fire(e.workspaceId, 'task.deleted', async () => ({ taskId: e.taskId, title: e.diff?.title, actorId: e.actorId }));
  }

  @OnEvent(Events.CommentCreated)
  onComment(e: CommentEvent) {
    this.fire(e.workspaceId, 'comment.created', async () => {
      const c = await this.prisma.comment.findUnique({ where: { id: e.commentId }, include: { author: { select: { id: true, name: true } } } });
      return c && { task: await this.taskPayload(e.taskId), comment: { id: c.id, text: (c.body as { text?: string })?.text ?? '', author: c.author } };
    });
  }

  @OnEvent(ChatEvent)
  onChat(e: ChatEventPayload) {
    if (e.kind !== 'created' || e.userIds) return; // public channels only; DMs stay private
    this.fire(e.workspaceId, 'chat.message', async () => {
      const m = await this.prisma.message.findUnique({ where: { id: e.messageId }, include: { author: { select: { id: true, name: true } }, channel: { select: { id: true, name: true } } } });
      return m && { channel: m.channel, message: { id: m.id, text: m.text, author: m.author, parentId: m.parentId } };
    });
  }
}

@Controller()
export class WebhooksController {
  constructor(private readonly hooks: WebhooksService) {}

  @Get('workspaces/:id/webhooks')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hooks.list(id, user.id);
  }

  @Post('workspaces/:id/webhooks')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateWebhookDto) {
    return this.hooks.create(id, user.id, dto);
  }

  @Patch('webhooks/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWebhookDto) {
    return this.hooks.update(id, user.id, dto);
  }

  @Delete('webhooks/:id') @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hooks.remove(id, user.id);
  }

  @Post('webhooks/:id/ping') @HttpCode(200)
  ping(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.hooks.ping(id, user.id);
  }
}
