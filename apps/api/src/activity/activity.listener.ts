import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { Events, type CommentEvent, type TaskEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';

/** Persists domain events as the workspace activity log. */
@Injectable()
export class ActivityListener {
  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(Events.TaskCreated, { async: true, promisify: true })
  @OnEvent(Events.TaskUpdated, { async: true, promisify: true })
  @OnEvent(Events.TaskDeleted, { async: true, promisify: true })
  async onTask(e: TaskEvent) {
    await this.prisma.activity.create({
      data: {
        workspaceId: e.workspaceId,
        actorId: e.actorId,
        entity: 'task',
        entityId: e.taskId,
        action: e.action,
        diff: (e.diff ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  @OnEvent(Events.CommentCreated, { async: true, promisify: true })
  async onComment(e: CommentEvent) {
    await this.prisma.activity.create({
      data: { workspaceId: e.workspaceId, actorId: e.actorId, entity: 'task', entityId: e.taskId, action: 'commented', diff: { commentId: e.commentId } },
    });
  }
}
