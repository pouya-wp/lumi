import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { Events, type CommentEvent } from '../common/events';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(10000) text!: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) mentionIds?: string[];
}

export class UpdateCommentDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(10000) text?: string;
  @IsOptional() @IsBoolean() resolved?: boolean;
}

const author = { select: { id: true, name: true, avatarUrl: true } } as const;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  async list(taskId: string, userId: string) {
    await this.access.task(taskId, userId);
    return this.prisma.comment.findMany({ where: { taskId }, include: { author }, orderBy: { createdAt: 'asc' } });
  }

  async create(taskId: string, userId: string, dto: CreateCommentDto) {
    // Guests may comment on tasks they can see.
    const task = await this.access.task(taskId, userId, 'GUEST');
    let parentAuthorId: string | undefined;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({ where: { id: dto.parentId, taskId } });
      if (!parent) throw new BadRequestException('Parent comment not found');
      parentAuthorId = parent.authorId;
    }
    const mentionIds = [...new Set(dto.mentionIds ?? [])];
    if (mentionIds.length) {
      const members = await this.prisma.membership.count({ where: { workspaceId: task.project.workspaceId, userId: { in: mentionIds } } });
      if (members !== mentionIds.length) throw new BadRequestException('Mentioned users must be workspace members');
    }

    const comment = await this.prisma.comment.create({
      data: { taskId, authorId: userId, parentId: dto.parentId, body: { text: dto.text, mentionIds } as Prisma.InputJsonValue },
      include: { author },
    });

    const payload = {
      taskId,
      commentId: comment.id,
      title: task.title,
      key: `${task.project.key}-${task.number}`,
      projectId: task.projectId,
      workspaceId: task.project.workspaceId,
      excerpt: dto.text.slice(0, 140),
    };
    await this.notifications.notify(mentionIds, userId, 'comment.mention', payload);
    if (parentAuthorId && !mentionIds.includes(parentAuthorId)) {
      await this.notifications.notify([parentAuthorId], userId, 'comment.reply', payload);
    }
    this.events.emit(Events.CommentCreated, {
      workspaceId: task.project.workspaceId,
      projectId: task.projectId,
      taskId,
      commentId: comment.id,
      actorId: userId,
    } satisfies CommentEvent);
    return comment;
  }

  async update(commentId: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.find(commentId);
    await this.access.task(comment.taskId, userId, 'GUEST');
    if (dto.text !== undefined && comment.authorId !== userId) throw new ForbiddenException('Only the author can edit');
    const body = comment.body as { text: string; mentionIds?: string[] };
    return this.prisma.comment.update({
      where: { id: commentId },
      data: {
        body: dto.text !== undefined ? ({ ...body, text: dto.text, edited: true } as Prisma.InputJsonValue) : undefined,
        resolvedAt: dto.resolved === undefined ? undefined : dto.resolved ? new Date() : null,
      },
      include: { author },
    });
  }

  async remove(commentId: string, userId: string) {
    const comment = await this.find(commentId);
    const task = await this.access.task(comment.taskId, userId, 'GUEST');
    if (comment.authorId !== userId) await this.access.membership(task.project.workspaceId, userId, 'ADMIN');
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  private async find(id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}
