import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type StatusCategory } from '@prisma/client';
import { AccessService } from '../common/access.service';
import { Events, type ProjectEvent } from '../common/events';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto, CreateStatusDto, UpdateProjectDto, UpdateStatusDto } from './projects.dto';

const DEFAULT_STATUSES: { category: StatusCategory; color: string; fa: string; en: string }[] = [
  { category: 'BACKLOG', color: '#8A8F99', fa: 'بک‌لاگ', en: 'Backlog' },
  { category: 'TODO', color: '#0EA5E9', fa: 'برای انجام', en: 'To do' },
  { category: 'IN_PROGRESS', color: '#4F5BFF', fa: 'در حال انجام', en: 'In progress' },
  { category: 'REVIEW', color: '#F97316', fa: 'بازبینی', en: 'Review' },
  { category: 'DONE', color: '#16A34A', fa: 'انجام شد', en: 'Done' },
];

const CATEGORY_COLORS: Record<StatusCategory, string> = {
  BACKLOG: '#8A8F99',
  TODO: '#0EA5E9',
  IN_PROGRESS: '#4F5BFF',
  REVIEW: '#F97316',
  DONE: '#16A34A',
  CANCELED: '#EF4444',
};

/** Derives a short uppercase key, e.g. "Mobile App" → "MA", "لومی" → "P1". */
function deriveKey(name: string, taken: Set<string>): string {
  const latin = name.replace(/[^A-Za-z0-9 ]/g, '').trim();
  let base = latin
    ? latin.split(/\s+/).length > 1
      ? latin.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase()
      : latin.slice(0, 3).toUpperCase()
    : 'P';
  if (!/^[A-Z]/.test(base)) base = `P${base}`;
  if (base.length < 2) base = `${base}R`;
  let key = base;
  for (let i = 1; taken.has(key); i++) key = `${base}${i}`;
  return key;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly events: EventEmitter2,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    const projects = await this.prisma.project.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    const counts = await this.prisma.task.groupBy({
      by: ['projectId', 'statusId'],
      where: { projectId: { in: projects.map((p) => p.id) }, deletedAt: null, archivedAt: null, parentId: null },
      _count: true,
    });
    return projects.map((p) => {
      const byCategory: Partial<Record<StatusCategory, number>> = {};
      for (const c of counts.filter((c) => c.projectId === p.id)) {
        const category = p.statuses.find((s) => s.id === c.statusId)?.category;
        if (category) byCategory[category] = (byCategory[category] ?? 0) + c._count;
      }
      const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
      return { ...p, counts: { total, ...byCategory } };
    });
  }

  async create(workspaceId: string, userId: string, dto: CreateProjectDto, locale = 'fa') {
    await this.access.membership(workspaceId, userId, 'MEMBER');
    return this.createUnchecked(workspaceId, userId, dto, locale);
  }

  /** Creates a project with default statuses; callers must have checked access. */
  async createUnchecked(workspaceId: string, actorId: string, dto: CreateProjectDto, locale = 'fa') {
    const existing = await this.prisma.project.findMany({ where: { workspaceId }, select: { key: true } });
    const taken = new Set(existing.map((p) => p.key));
    if (dto.key && taken.has(dto.key)) throw new BadRequestException('Project key already in use');
    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name,
        key: dto.key ?? deriveKey(dto.name, taken),
        icon: dto.icon,
        color: dto.color ?? '#4F5BFF',
        methodology: dto.methodology ?? ['KANBAN'],
        statuses: {
          create: DEFAULT_STATUSES.map((s, order) => ({
            name: locale === 'en' ? s.en : s.fa,
            category: s.category,
            color: s.color,
            order,
          })),
        },
      },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    this.emit(workspaceId, project.id, actorId);
    return project;
  }

  async get(projectId: string, userId: string) {
    await this.access.project(projectId, userId);
    return this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto) {
    const project = await this.access.project(projectId, userId, 'MEMBER');
    const { proposals, ...fields } = dto;
    const settings =
      proposals === undefined
        ? undefined
        : ({ ...((project.settings as object | null) ?? {}), proposals } as Prisma.InputJsonValue);
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { ...fields, settings },
      include: { statuses: { orderBy: { order: 'asc' } } },
    });
    this.emit(project.workspaceId, projectId, userId);
    return updated;
  }

  async archive(projectId: string, userId: string) {
    const project = await this.access.project(projectId, userId, 'ADMIN');
    await this.prisma.project.update({ where: { id: projectId }, data: { archivedAt: new Date() } });
    this.emit(project.workspaceId, projectId, userId);
  }

  async createStatus(projectId: string, userId: string, dto: CreateStatusDto) {
    const project = await this.access.project(projectId, userId, 'MEMBER');
    const last = await this.prisma.status.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });
    const status = await this.prisma.status.create({
      data: { projectId, name: dto.name, category: dto.category, color: dto.color ?? CATEGORY_COLORS[dto.category], order: (last?.order ?? -1) + 1 },
    });
    this.emit(project.workspaceId, projectId, userId);
    return status;
  }

  async updateStatus(statusId: string, userId: string, dto: UpdateStatusDto) {
    const status = await this.findStatus(statusId);
    const project = await this.access.project(status.projectId, userId, 'MEMBER');
    const updated = await this.prisma.status.update({ where: { id: statusId }, data: dto });
    this.emit(project.workspaceId, project.id, userId);
    return updated;
  }

  /** Deletes a status, moving its tasks to `moveTo` (required when the status has tasks). */
  async deleteStatus(statusId: string, userId: string, moveTo?: string) {
    const status = await this.findStatus(statusId);
    const project = await this.access.project(status.projectId, userId, 'MEMBER');
    const taskCount = await this.prisma.task.count({ where: { statusId } });
    if (taskCount > 0) {
      const target = moveTo && (await this.prisma.status.findFirst({ where: { id: moveTo, projectId: project.id } }));
      if (!target || target.id === statusId) throw new BadRequestException('moveTo must be another status of this project');
      await this.prisma.task.updateMany({ where: { statusId }, data: { statusId: target.id } });
    }
    await this.prisma.status.delete({ where: { id: statusId } });
    this.emit(project.workspaceId, project.id, userId);
  }

  private async findStatus(statusId: string) {
    const status = await this.prisma.status.findUnique({ where: { id: statusId } });
    if (!status) throw new NotFoundException('Status not found');
    return status;
  }

  private emit(workspaceId: string, projectId: string, actorId: string) {
    this.events.emit(Events.ProjectChanged, { workspaceId, projectId, actorId } satisfies ProjectEvent);
  }
}
