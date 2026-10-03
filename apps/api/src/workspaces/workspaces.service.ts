import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { rankBetween } from '@lumi/shared';
import type { Priority } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateLabelDto, CreateWorkspaceDto, InviteDto, UpdateMemberDto, UpdateWorkspaceDto } from './workspaces.dto';

const LABEL_COLORS = ['#4F5BFF', '#F43F5E', '#16A34A', '#F97316', '#EAB308', '#8B5CF6', '#0EA5E9'];

const STARTER_TASKS: Record<'fa' | 'en', { title: string; priority: Priority; category: 'TODO' | 'IN_PROGRESS' | 'DONE' }[]> = {
  fa: [
    { title: 'به لومی خوش اومدی ✨ این تسک رو تیک بزن', priority: 'LOW', category: 'DONE' },
    { title: 'هم‌تیمی‌هات رو دعوت کن', priority: 'HIGH', category: 'TODO' },
    { title: 'اولین پروژه واقعی‌ات رو بساز', priority: 'MEDIUM', category: 'TODO' },
    { title: 'با Ctrl+K همه‌جا رو بگرد', priority: 'NONE', category: 'IN_PROGRESS' },
  ],
  en: [
    { title: 'Welcome to Lumi ✨ check this off', priority: 'LOW', category: 'DONE' },
    { title: 'Invite your teammates', priority: 'HIGH', category: 'TODO' },
    { title: 'Create your first real project', priority: 'MEDIUM', category: 'TODO' },
    { title: 'Press Ctrl+K to search everything', priority: 'NONE', category: 'IN_PROGRESS' },
  ],
};

function slugify(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${base || 'ws'}-${Math.random().toString(36).slice(2, 7)}`;
}

const memberUser = { id: true, name: true, email: true, avatarUrl: true } as const;

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly projects: ProjectsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { workspace: { include: { _count: { select: { memberships: true, projects: true } } } } },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }

  async create(userId: string, dto: CreateWorkspaceDto, opts: { withStarterProject?: boolean; locale?: string } = {}) {
    const workspace = await this.prisma.workspace.create({
      data: { name: dto.name, slug: slugify(dto.name), memberships: { create: { userId, role: 'OWNER' } } },
    });
    if (opts.withStarterProject) await this.seedStarterProject(workspace.id, userId, opts.locale === 'en' ? 'en' : 'fa');
    return { ...workspace, role: 'OWNER' as const };
  }

  async get(workspaceId: string, userId: string) {
    const me = await this.access.membership(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: {
        memberships: { include: { user: { select: memberUser } }, orderBy: { joinedAt: 'asc' } },
        invites: { where: { acceptedAt: null }, orderBy: { createdAt: 'desc' } },
      },
    });
    const { memberships, invites, ...rest } = workspace;
    return {
      ...rest,
      role: me.role,
      members: memberships.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })),
      invites: AccessService.outranks(me.role, 'MEMBER') ? invites : [],
    };
  }

  async update(workspaceId: string, userId: string, dto: UpdateWorkspaceDto) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    return this.prisma.workspace.update({ where: { id: workspaceId }, data: dto });
  }

  /** Adds an existing user directly; otherwise records a pending invite accepted on sign-up. */
  async invite(workspaceId: string, userId: string, dto: InviteDto) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    const email = dto.email.toLowerCase();
    const role = dto.role ?? 'MEMBER';
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      const already = await this.prisma.membership.findUnique({
        where: { userId_workspaceId: { userId: existing.id, workspaceId } },
      });
      if (already) throw new BadRequestException('User is already a member');
      await this.prisma.membership.create({ data: { userId: existing.id, workspaceId, role } });
      await this.notifications.notify([existing.id], userId, 'workspace.joined', { workspaceId });
      return { status: 'added' as const };
    }
    await this.prisma.invite.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      create: { workspaceId, email, role, invitedById: userId },
      update: { role },
    });
    return { status: 'invited' as const };
  }

  async revokeInvite(workspaceId: string, userId: string, inviteId: string) {
    await this.access.membership(workspaceId, userId, 'ADMIN');
    await this.prisma.invite.deleteMany({ where: { id: inviteId, workspaceId, acceptedAt: null } });
  }

  async acceptPendingInvites(userId: string, email: string) {
    const invites = await this.prisma.invite.findMany({ where: { email, acceptedAt: null } });
    for (const invite of invites) {
      await this.prisma.membership.create({ data: { userId, workspaceId: invite.workspaceId, role: invite.role } });
      await this.prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      await this.notifications.notify([invite.invitedById], userId, 'workspace.joined', { workspaceId: invite.workspaceId });
    }
    return invites.length;
  }

  async updateMember(workspaceId: string, userId: string, memberId: string, dto: UpdateMemberDto) {
    const me = await this.access.membership(workspaceId, userId, 'ADMIN');
    const target = await this.access.membership(workspaceId, memberId).catch(() => {
      throw new NotFoundException('Member not found');
    });
    if (target.role === 'OWNER') throw new ForbiddenException('Cannot change the owner role');
    if (dto.role === 'ADMIN' && me.role !== 'OWNER') throw new ForbiddenException('Only the owner can promote admins');
    await this.prisma.membership.update({ where: { userId_workspaceId: { userId: memberId, workspaceId } }, data: { role: dto.role } });
  }

  async removeMember(workspaceId: string, userId: string, memberId: string) {
    if (memberId !== userId) await this.access.membership(workspaceId, userId, 'ADMIN');
    const target = await this.access.membership(workspaceId, memberId).catch(() => {
      throw new NotFoundException('Member not found');
    });
    if (target.role === 'OWNER') throw new ForbiddenException('The owner cannot be removed');
    await this.prisma.membership.delete({ where: { userId_workspaceId: { userId: memberId, workspaceId } } });
  }

  async labels(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    return this.prisma.label.findMany({ where: { workspaceId }, orderBy: { name: 'asc' } });
  }

  async createLabel(workspaceId: string, userId: string, dto: CreateLabelDto) {
    await this.access.membership(workspaceId, userId, 'MEMBER');
    const count = await this.prisma.label.count({ where: { workspaceId } });
    return this.prisma.label.create({
      data: { workspaceId, name: dto.name, color: dto.color ?? LABEL_COLORS[count % LABEL_COLORS.length] },
    });
  }

  private async seedStarterProject(workspaceId: string, userId: string, locale: 'fa' | 'en') {
    const project = await this.projects.createUnchecked(
      workspaceId,
      userId,
      { name: locale === 'en' ? 'Getting started' : 'شروع با لومی', icon: '✨', methodology: ['KANBAN'] },
      locale,
    );
    let orderKey: string | null = null;
    const tasks = STARTER_TASKS[locale];
    for (const [i, t] of tasks.entries()) {
      orderKey = rankBetween(orderKey, null);
      const status = project.statuses.find((s) => s.category === t.category)!;
      await this.prisma.task.create({
        data: {
          projectId: project.id,
          number: i + 1,
          title: t.title,
          priority: t.priority,
          statusId: status.id,
          orderKey,
          createdById: userId,
          completedAt: t.category === 'DONE' ? new Date() : null,
          assignees: { create: { userId, role: 'ASSIGNEE' } },
        },
      });
    }
    await this.prisma.project.update({ where: { id: project.id }, data: { taskCounter: tasks.length } });
  }
}
