import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { Events, type CommentEvent, type NotificationEvent, type ProjectEvent, type TaskEvent } from '../common/events';
import { ChatEvent, type ChatEventPayload } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pushes domain events to clients. Each socket joins `user:<id>` and one `workspace:<id>` room per membership;
 * clients use the events to invalidate cached queries.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    try {
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
      const memberships = await this.prisma.membership.findMany({ where: { userId: sub }, select: { workspaceId: true } });
      await socket.join([`user:${sub}`, ...memberships.map((m) => `workspace:${m.workspaceId}`)]);
      socket.data.userId = sub;
    } catch {
      this.logger.debug('Rejected realtime connection with invalid token');
      socket.disconnect(true);
    }
  }

  @OnEvent(Events.TaskCreated)
  @OnEvent(Events.TaskUpdated)
  @OnEvent(Events.TaskDeleted)
  onTask(e: TaskEvent) {
    this.server?.to(`workspace:${e.workspaceId}`).emit('task', e);
  }

  @OnEvent(Events.CommentCreated)
  onComment(e: CommentEvent) {
    this.server?.to(`workspace:${e.workspaceId}`).emit('comment', e);
  }

  @OnEvent(Events.ProjectChanged)
  onProject(e: ProjectEvent) {
    this.server?.to(`workspace:${e.workspaceId}`).emit('project', e);
  }

  @OnEvent(ChatEvent)
  onChat(e: ChatEventPayload) {
    if (e.userIds) for (const id of e.userIds) this.server?.to(`user:${id}`).emit('chat', e);
    else this.server?.to(`workspace:${e.workspaceId}`).emit('chat', e);
  }

  @OnEvent(Events.NotificationCreated)
  onNotification(e: NotificationEvent) {
    this.server?.to(`user:${e.userId}`).emit('notification', e.notification);
  }
}
