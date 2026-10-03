import { BadRequestException, Body, Controller, Delete, Headers, HttpCode, Injectable, Logger, NotFoundException, Param, Post, UnauthorizedException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { parseQuickAdd } from '@lumi/shared';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { Events, type NotificationEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { publicApiUrl, safeEqual, token } from './crypto';

export class ConnectTelegramDto {
  @IsString() @MinLength(20) botToken!: string;
  @IsOptional() @IsString() defaultProjectId?: string;
}

interface TelegramConfig {
  botToken: string;
  username: string;
  pathSecret: string;
  defaultProjectId?: string;
}

interface TgUpdate {
  message?: { text?: string; chat: { id: number }; from?: { first_name?: string } };
}

const apiBase = () => process.env.TELEGRAM_API_URL ?? 'https://api.telegram.org';

/** Short notification lines per type, in the member's language. */
const NOTIFY: Record<string, { fa: string; en: string }> = {
  'task.assigned': { fa: '📌 تسک جدید برات: «{t}»', en: '📌 New task for you: “{t}”' },
  'task.proposed': { fa: '🤝 پیشنهاد تسک: «{t}»', en: '🤝 Task proposed: “{t}”' },
  'task.proposal.accepted': { fa: '✅ «{t}» قبول شد', en: '✅ “{t}” was accepted' },
  'task.proposal.declined': { fa: '🙅 «{t}» رد شد', en: '🙅 “{t}” was declined' },
  'task.proposal.countered': { fa: '📅 ددلاین جدید برای «{t}» پیشنهاد شد', en: '📅 New date proposed for “{t}”' },
  'task.status': { fa: '🔄 وضعیت «{t}» عوض شد', en: '🔄 “{t}” changed status' },
  'comment.mention': { fa: '💬 در «{t}» منشن شدی', en: '💬 You were mentioned in “{t}”' },
  'comment.reply': { fa: '↩️ جواب جدید در «{t}»', en: '↩️ New reply in “{t}”' },
  badge: { fa: '🏅 نشان جدید گرفتی!', en: '🏅 You earned a new badge!' },
};

/**
 * Telegram bot per workspace. Members link their chat with a one-time /start code, then
 * any message becomes a task (quick-add syntax works), /today lists their tasks and
 * their Lumi notifications are forwarded to the chat.
 */
@Injectable()
export class TelegramService {
  private readonly log = new Logger('Telegram');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly tasks: TasksService,
  ) {}

  private async call<T>(botToken: string, method: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${apiBase()}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!json.ok) throw new BadRequestException(`Telegram: ${json.description ?? res.status}`);
    return json.result as T;
  }

  send(config: TelegramConfig, chatId: string | number, text: string) {
    return this.call(config.botToken, 'sendMessage', { chat_id: chatId, text, disable_web_page_preview: true }).catch((e) => this.log.warn(String(e)));
  }

  private async config(workspaceId: string) {
    const row = await this.prisma.integration.findUnique({ where: { workspaceId_kind: { workspaceId, kind: 'telegram' } } });
    return row ? (row.config as unknown as TelegramConfig) : null;
  }

  async connect(workspaceId: string, userId: string, dto: ConnectTelegramDto) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    if (dto.defaultProjectId) {
      const p = await this.prisma.project.findFirst({ where: { id: dto.defaultProjectId, workspaceId } });
      if (!p) throw new BadRequestException('Project not in workspace');
    }
    const me = await this.call<{ username: string }>(dto.botToken, 'getMe', {});
    const config: TelegramConfig = { botToken: dto.botToken, username: me.username, pathSecret: token('', 18), defaultProjectId: dto.defaultProjectId };
    await this.prisma.integration.upsert({
      where: { workspaceId_kind: { workspaceId, kind: 'telegram' } },
      create: { workspaceId, kind: 'telegram', config: { ...config } },
      update: { config: { ...config } },
    });
    const url = `${publicApiUrl()}/api/integrations/telegram/${workspaceId}/${config.pathSecret}`;
    let webhookError: string | undefined;
    try {
      await this.call(dto.botToken, 'setWebhook', { url, secret_token: config.pathSecret, allowed_updates: ['message'] });
    } catch (e) {
      // Telegram only accepts public HTTPS URLs; local setups can still link and send.
      webhookError = e instanceof Error ? e.message : String(e);
    }
    return { username: me.username, webhookUrl: url, webhookError };
  }

  async disconnect(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    const config = await this.config(workspaceId);
    if (config) await this.call(config.botToken, 'deleteWebhook', {}).catch(() => undefined);
    await this.prisma.integration.deleteMany({ where: { workspaceId, kind: 'telegram' } });
    await this.prisma.telegramLink.deleteMany({ where: { workspaceId } });
  }

  /** One-time deep link that ties the caller's Telegram chat to their account. */
  async linkCode(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    const config = await this.config(workspaceId);
    if (!config) throw new NotFoundException('Telegram is not connected');
    const code = token('', 12).replace(/[^A-Za-z0-9]/g, 'x');
    const link = await this.prisma.telegramLink.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, code },
      update: { code },
    });
    return { code, deepLink: `https://t.me/${config.username}?start=${code}`, linked: !!link.chatId };
  }

  async receive(workspaceId: string, pathSecret: string, headerSecret: string | undefined, update: TgUpdate) {
    const config = await this.config(workspaceId);
    if (!config || !safeEqual(pathSecret, config.pathSecret) || (headerSecret !== undefined && !safeEqual(headerSecret, config.pathSecret))) {
      throw new UnauthorizedException();
    }
    const msg = update.message;
    if (!msg?.text) return { ok: true };
    const chatId = String(msg.chat.id);
    const text = msg.text.trim();

    if (text.startsWith('/start')) {
      const code = text.split(/\s+/)[1];
      const link = code ? await this.prisma.telegramLink.findUnique({ where: { code } }) : null;
      if (!link || link.workspaceId !== workspaceId) {
        await this.send(config, chatId, 'سلام! 👋 برای وصل شدن، از تنظیمات لومی «اتصال تلگرام» رو بزن.\nHi! Use “Connect Telegram” in Lumi settings to link this chat.');
        return { ok: true };
      }
      await this.prisma.telegramLink.update({ where: { id: link.id }, data: { chatId, linkedAt: new Date(), code: token('used_', 12) } });
      const user = await this.prisma.user.findUnique({ where: { id: link.userId }, select: { name: true, locale: true } });
      await this.send(
        config,
        chatId,
        user?.locale === 'en'
          ? `✅ Linked, ${user.name}! Send any message to create a task, /today for your list.`
          : `✅ وصل شدی ${user?.name ?? ''}! هر پیامی بفرستی تسک می‌شه — /today برای کارهای امروز.`,
      );
      return { ok: true, linked: true };
    }

    const link = await this.prisma.telegramLink.findFirst({ where: { workspaceId, chatId } });
    if (!link) {
      await this.send(config, chatId, '🔒 این چت هنوز به لومی وصل نیست. / This chat is not linked to Lumi yet.');
      return { ok: true };
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: link.userId }, select: { id: true, locale: true } });
    const fa = user.locale !== 'en';

    if (text === '/today' || text === '/tasks') {
      const list = await this.tasks.myTasks(user.id, { workspaceId, scope: 'today' });
      const lines = list.slice(0, 15).map((t) => `• ${t.key} — ${t.title}`);
      await this.send(config, chatId, lines.length ? `${fa ? '🎯 کارهای امروز:' : '🎯 Today:'}\n${lines.join('\n')}` : fa ? '☕ امروز کاری نداری!' : '☕ Nothing due today!');
      return { ok: true };
    }
    if (text === '/help') {
      await this.send(config, chatId, fa ? 'هر پیام = یک تسک (مثلاً «فردا ساعت ۱۰ گزارش !فوری #مارکتینگ»)\n/today کارهای امروز' : 'Any message = a task (e.g. “tomorrow 10am report !urgent #marketing”)\n/today your tasks');
      return { ok: true };
    }

    const projectId = config.defaultProjectId ?? (await this.prisma.project.findFirst({ where: { workspaceId, archivedAt: null }, orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id;
    if (!projectId) return { ok: true };
    const parsed = parseQuickAdd(text.replace(/^\/new\s*/, ''));
    const task = await this.tasks.create(projectId, user.id, {
      title: parsed.title || text.slice(0, 300),
      dueAt: parsed.dueAt?.toISOString(),
      priority: parsed.priority,
      labelNames: parsed.labels,
      assigneeIds: [user.id],
    });
    await this.send(config, chatId, `${fa ? '✅ ساخته شد' : '✅ Created'}: ${task.key} — ${task.title}`);
    return { ok: true, taskId: task.id };
  }

  /** Forwards Lumi notifications to every linked chat of the recipient. */
  @OnEvent(Events.NotificationCreated)
  async onNotification(e: NotificationEvent) {
    const links = await this.prisma.telegramLink.findMany({ where: { userId: e.userId, chatId: { not: null } } });
    if (!links.length) return;
    const user = await this.prisma.user.findUnique({ where: { id: e.userId }, select: { locale: true } });
    const payload = (e.notification.payload ?? {}) as { title?: string; workspaceId?: string; key?: string };
    const tpl = NOTIFY[e.notification.type];
    if (!tpl) return;
    const line = tpl[user?.locale === 'en' ? 'en' : 'fa'].replace('{t}', payload.title ?? '');
    for (const link of links) {
      if (payload.workspaceId && payload.workspaceId !== link.workspaceId) continue;
      const config = await this.config(link.workspaceId);
      if (config) await this.send(config, link.chatId!, payload.key ? `${line}\n${payload.key}` : line);
    }
  }
}

@Controller()
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Post('workspaces/:id/integrations/telegram')
  connect(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ConnectTelegramDto) {
    return this.telegram.connect(id, user.id, dto);
  }

  @Delete('workspaces/:id/integrations/telegram') @HttpCode(204)
  disconnect(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.telegram.disconnect(id, user.id);
  }

  @Post('workspaces/:id/integrations/telegram/link') @HttpCode(200)
  link(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.telegram.linkCode(id, user.id);
  }

  @Public()
  @Post('integrations/telegram/:workspaceId/:secret') @HttpCode(200)
  receive(
    @Param('workspaceId') workspaceId: string,
    @Param('secret') secret: string,
    @Headers('x-telegram-bot-api-secret-token') header: string | undefined,
    @Body() update: TgUpdate,
  ) {
    return this.telegram.receive(workspaceId, secret, header, update);
  }
}
