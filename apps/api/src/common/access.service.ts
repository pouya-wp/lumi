import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RANK: Record<Role, number> = { VIEWER: 0, GUEST: 1, MEMBER: 2, ADMIN: 3, OWNER: 4 };

/** Resolves an entity and checks the caller's workspace role against a minimum. */
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async membership(workspaceId: string, userId: string, min: Role = 'VIEWER') {
    const m = await this.prisma.membership.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
    if (!m) throw new NotFoundException('Workspace not found');
    if (RANK[m.role] < RANK[min]) throw new ForbiddenException('Insufficient role');
    return m;
  }

  async project(projectId: string, userId: string, min: Role = 'VIEWER') {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    await this.membership(project.workspaceId, userId, min);
    return project;
  }

  async task(taskId: string, userId: string, min: Role = 'VIEWER') {
    const task = await this.prisma.task.findFirst({ where: { id: taskId, deletedAt: null }, include: { project: true } });
    if (!task) throw new NotFoundException('Task not found');
    await this.membership(task.project.workspaceId, userId, min);
    return task;
  }

  static outranks(role: Role, other: Role) {
    return RANK[role] > RANK[other];
  }
}
