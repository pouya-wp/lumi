import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { Events, type NotificationEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationType =
  | 'task.assigned'
  | 'task.proposed'
  | 'task.proposal.accepted'
  | 'task.proposal.declined'
  | 'task.proposal.countered'
  | 'task.status'
  | 'comment.mention'
  | 'comment.reply'
  | 'workspace.joined';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Notifies each recipient except the actor who caused it. */
  async notify(recipients: Iterable<string>, actorId: string, type: NotificationType, payload: Record<string, unknown>) {
    const unique = [...new Set(recipients)].filter((id) => id !== actorId);
    for (const userId of unique) {
      const notification = await this.prisma.notification.create({
        data: { userId, type, payload: { ...payload, actorId } as Prisma.InputJsonValue },
      });
      this.events.emit(Events.NotificationCreated, { userId, notification } satisfies NotificationEvent);
    }
  }

  async list(userId: string, unreadOnly: boolean, take = 50) {
    const items = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    const actorIds = [...new Set(items.map((n) => (n.payload as { actorId?: string }).actorId).filter(Boolean))] as string[];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, avatarUrl: true } });
    const byId = new Map(actors.map((a) => [a.id, a]));
    return items.map((n) => ({ ...n, actor: byId.get((n.payload as { actorId?: string }).actorId ?? '') ?? null }));
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }

  async snooze(userId: string, id: string, until: Date) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { snoozedUntil: until } });
  }
}
