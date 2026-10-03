import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type Channel } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

export class CreateChannelDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsOptional() @IsString() @MaxLength(200) topic?: string;
  @IsOptional() @IsString() @MaxLength(8) emoji?: string;
}

export class SendMessageDto {
  @IsString() @MinLength(1) @MaxLength(8000) text!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) mentionIds?: string[];
}

export class EditMessageDto {
  @IsString() @MinLength(1) @MaxLength(8000) text!: string;
}

export class ReactDto {
  @IsString() @MaxLength(16) emoji!: string;
}

export class ToTaskDto {
  @IsString() projectId!: string;
}

export const ChatEvent = 'chat.message';
export interface ChatEventPayload {
  workspaceId: string;
  channelId: string;
  messageId: string;
  kind: 'created' | 'updated' | 'deleted';
  /** Recipients for direct channels; public channels go to the whole workspace. */
  userIds?: string[];
}

const author = { select: { id: true, name: true, avatarUrl: true } } as const;

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: EventEmitter2,
    private readonly notifications: NotificationsService,
    private readonly tasks: TasksService,
  ) {}

  /** Public channels plus the caller's DMs, with unread counts; creates #general on first use. */
  async channels(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    if (!(await this.prisma.channel.count({ where: { workspaceId, kind: 'PUBLIC' } }))) {
      await this.prisma.channel.create({ data: { workspaceId, name: 'عمومی', emoji: '💬', topic: 'گفتگوی همه‌ی تیم' } });
    }
    const channels = await this.prisma.channel.findMany({
      where: { workspaceId, OR: [{ kind: 'PUBLIC' }, { members: { some: { userId } } }] },
      include: { members: { include: { user: author } } },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(
      channels.map(async (c) => {
        const me = c.members.find((m) => m.userId === userId);
        const [unread, last] = await Promise.all([
          this.prisma.message.count({ where: { channelId: c.id, parentId: null, deletedAt: null, authorId: { not: userId }, createdAt: { gt: me?.lastReadAt ?? new Date(0) } } }),
          this.prisma.message.findFirst({ where: { channelId: c.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { author } }),
        ]);
        return { ...c, members: c.members.map((m) => m.user), unread, last };
      }),
    );
  }

  async createChannel(workspaceId: string, userId: string, dto: CreateChannelDto) {
    await this.access.membership(workspaceId, userId, 'MEMBER');
    return this.prisma.channel.create({ data: { workspaceId, name: dto.name, topic: dto.topic, emoji: dto.emoji, members: { create: { userId } } } });
  }

  async direct(workspaceId: string, userId: string, otherId: string) {
    await this.access.membership(workspaceId, userId);
    await this.access.membership(workspaceId, otherId);
    if (otherId === userId) throw new BadRequestException('Pick someone else');
    const dmKey = [userId, otherId].sort().join(':');
    const existing = await this.prisma.channel.findUnique({ where: { workspaceId_dmKey: { workspaceId, dmKey } } });
    if (existing) return existing;
    return this.prisma.channel.create({
      data: { workspaceId, kind: 'DIRECT', name: 'dm', dmKey, members: { create: [{ userId }, { userId: otherId }] } },
    });
  }

  async messages(channelId: string, userId: string, before?: string) {
    const channel = await this.channel(channelId, userId);
    const items = await this.prisma.message.findMany({
      where: { channelId: channel.id, parentId: null, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      include: { author, _count: { select: { replies: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return items.reverse().map((m) => this.present(m));
  }

  async thread(messageId: string, userId: string) {
    const root = await this.findMessage(messageId);
    await this.channel(root.channelId, userId);
    const replies = await this.prisma.message.findMany({ where: { parentId: messageId }, include: { author }, orderBy: { createdAt: 'asc' } });
    const full = await this.prisma.message.findUniqueOrThrow({ where: { id: messageId }, include: { author, _count: { select: { replies: true } } } });
    return { root: this.present(full), replies: replies.map((m) => this.present(m)) };
  }

  async send(channelId: string, userId: string, dto: SendMessageDto) {
    const channel = await this.channel(channelId, userId);
    if (dto.parentId) {
      const parent = await this.findMessage(dto.parentId);
      if (parent.channelId !== channelId || parent.parentId) throw new BadRequestException('Invalid thread');
    }
    const mentionIds = [...new Set(dto.mentionIds ?? [])];
    if (mentionIds.length) {
      const ok = await this.prisma.membership.count({ where: { workspaceId: channel.workspaceId, userId: { in: mentionIds } } });
      if (ok !== mentionIds.length) throw new BadRequestException('Mentioned users must be workspace members');
    }
    const message = await this.prisma.message.create({
      data: { channelId, authorId: userId, text: dto.text, parentId: dto.parentId, mentionIds },
      include: { author, _count: { select: { replies: true } } },
    });
    await this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
    const recipients = channel.kind === 'DIRECT' ? channel.members.map((m) => m.userId).filter((id) => id !== userId) : mentionIds;
    await this.notifications.notify(recipients, userId, 'comment.mention', {
      channelId,
      workspaceId: channel.workspaceId,
      title: channel.kind === 'DIRECT' ? '💬' : `#${channel.name}`,
      excerpt: dto.text.slice(0, 140),
    });
    this.emit(channel, message.id, 'created');
    return this.present(message);
  }

  async edit(messageId: string, userId: string, dto: EditMessageDto) {
    const m = await this.findMessage(messageId);
    if (m.authorId !== userId) throw new ForbiddenException('Only the author can edit');
    const channel = await this.channel(m.channelId, userId);
    const updated = await this.prisma.message.update({ where: { id: messageId }, data: { text: dto.text, editedAt: new Date() }, include: { author, _count: { select: { replies: true } } } });
    this.emit(channel, messageId, 'updated');
    return this.present(updated);
  }

  async remove(messageId: string, userId: string) {
    const m = await this.findMessage(messageId);
    const channel = await this.channel(m.channelId, userId);
    if (m.authorId !== userId) await this.access.membership(channel.workspaceId, userId, 'ADMIN');
    await this.prisma.message.update({ where: { id: messageId }, data: { deletedAt: new Date(), text: '' } });
    this.emit(channel, messageId, 'deleted');
  }

  async react(messageId: string, userId: string, emoji: string) {
    const m = await this.findMessage(messageId);
    const channel = await this.channel(m.channelId, userId);
    const reactions = { ...((m.reactions as Record<string, string[]>) ?? {}) };
    const users = new Set(reactions[emoji] ?? []);
    if (users.has(userId)) users.delete(userId);
    else users.add(userId);
    if (users.size) reactions[emoji] = [...users];
    else delete reactions[emoji];
    await this.prisma.message.update({ where: { id: messageId }, data: { reactions: reactions as Prisma.InputJsonValue } });
    this.emit(channel, messageId, 'updated');
    return reactions;
  }

  async markRead(channelId: string, userId: string) {
    await this.channel(channelId, userId);
    await this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      create: { channelId, userId, lastReadAt: new Date() },
      update: { lastReadAt: new Date() },
    });
  }

  /** Turns a message into a task (first line → title) and links it back. */
  async toTask(messageId: string, userId: string, dto: ToTaskDto) {
    const m = await this.findMessage(messageId);
    const channel = await this.channel(m.channelId, userId);
    const [first, ...rest] = m.text.split('\n');
    const task = await this.tasks.create(dto.projectId, userId, {
      title: first.slice(0, 300) || '—',
      description: { text: [rest.join('\n'), `— ${channel.kind === 'PUBLIC' ? `#${channel.name}` : 'DM'}`].filter(Boolean).join('\n\n') },
      assigneeIds: [userId],
    });
    await this.prisma.message.update({ where: { id: messageId }, data: { taskId: task.id } });
    this.emit(channel, messageId, 'updated');
    return task;
  }

  private present<T extends { deletedAt: Date | null; text: string; _count?: { replies: number } }>(m: T) {
    const { _count, ...rest } = m;
    return { ...rest, replyCount: _count?.replies ?? 0 };
  }

  private async channel(id: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id }, include: { members: true } });
    if (!channel) throw new NotFoundException('Channel not found');
    await this.access.membership(channel.workspaceId, userId);
    if (channel.kind === 'DIRECT' && !channel.members.some((m) => m.userId === userId)) throw new NotFoundException('Channel not found');
    return channel;
  }

  private async findMessage(id: string) {
    const m = await this.prisma.message.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Message not found');
    return m;
  }

  private emit(channel: Channel & { members: { userId: string }[] }, messageId: string, kind: ChatEventPayload['kind']) {
    this.events.emit(ChatEvent, {
      workspaceId: channel.workspaceId,
      channelId: channel.id,
      messageId,
      kind,
      userIds: channel.kind === 'DIRECT' ? channel.members.map((m) => m.userId) : undefined,
    } satisfies ChatEventPayload);
  }
}
