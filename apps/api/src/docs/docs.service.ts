import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { rankBetween } from '@lumi/shared';
import { Prisma, type DocKind } from '@prisma/client';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsObject, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

export class CreateDocDto {
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(16) icon?: string;
  @IsOptional() @IsIn(['blank', 'meeting', 'prd', 'retro', 'onboarding']) template?: string;
  @IsOptional() @IsDateString() meetingAt?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsString({ each: true }) attendeeIds?: string[];
  @IsOptional() @IsString() projectId?: string;
}

export class UpdateDocDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(16) icon?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(64) cover?: string | null;
  @IsOptional() @IsBoolean() fullWidth?: boolean;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() meetingAt?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) attendeeIds?: string[];
  @IsOptional() @IsBoolean() archived?: boolean;
}

export class SnapshotDto {
  @IsObject() content!: Record<string, unknown>;
  @IsString() @MaxLength(500_000) text!: string;
}

export class MoveDocDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() parentId?: string | null;
  @IsOptional() @IsString() beforeId?: string;
  @IsOptional() @IsString() afterId?: string;
}

type Node = Record<string, unknown>;
const p = (text?: string): Node => (text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' });
const h = (level: number, text: string): Node => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const todo = (...items: string[]): Node => ({
  type: 'taskList',
  content: items.map((t) => ({ type: 'taskItem', attrs: { checked: false }, content: [p(t)] })),
});
const bullets = (...items: string[]): Node => ({ type: 'bulletList', content: items.map((t) => ({ type: 'listItem', content: [p(t)] })) });
const callout = (emoji: string, text: string): Node => ({ type: 'callout', attrs: { emoji }, content: [p(text)] });

/** Starter content per template, in Persian. */
export function templateContent(template: string | undefined): { title: string; icon: string; kind: DocKind; doc: Node } {
  switch (template) {
    case 'meeting':
      return {
        title: 'جلسه',
        icon: '🗓️',
        kind: 'MEETING',
        doc: {
          type: 'doc',
          content: [
            callout('🎯', 'هدف این جلسه چیه؟ یک جمله.'),
            h(2, 'دستور جلسه'),
            bullets('', ''),
            h(2, 'یادداشت‌ها'),
            p(),
            h(2, 'تصمیم‌ها'),
            bullets(''),
            h(2, 'اقدام‌ها'),
            todo('', ''),
          ],
        },
      };
    case 'prd':
      return {
        title: 'سند نیازمندی محصول',
        icon: '📐',
        kind: 'PAGE',
        doc: {
          type: 'doc',
          content: [
            callout('💡', 'مسئله را در یک پاراگراف توضیح بده: برای چه کسی، چه دردی، چرا الان؟'),
            h(2, 'اهداف'),
            bullets('', ''),
            h(2, 'غیر‌اهداف'),
            bullets(''),
            h(2, 'داستان‌های کاربری'),
            bullets('به‌عنوان … می‌خواهم … تا …'),
            h(2, 'معیار پذیرش'),
            todo('', ''),
            h(2, 'سؤال‌های باز'),
            p(),
          ],
        },
      };
    case 'retro':
      return {
        title: 'رترو',
        icon: '🔁',
        kind: 'PAGE',
        doc: { type: 'doc', content: [h(2, 'چی خوب بود 😊'), bullets(''), h(2, 'چی بهتر بشه 🤔'), bullets(''), h(2, 'اقدام‌ها 🎯'), todo('')] },
      };
    case 'onboarding':
      return {
        title: 'خوش اومدی به بیاندکس',
        icon: '👋',
        kind: 'PAGE',
        doc: {
          type: 'doc',
          content: [
            callout('✨', 'این صفحه همه چیزیه که روز اول لازم داری.'),
            h(2, 'ابزارها'),
            todo('اکانت لومی', 'دسترسی گیت‌هاب', 'نصب اپ موبایل'),
            h(2, 'آدم‌ها'),
            bullets('پویا صادق‌پور', 'امیرحسین قطبی', 'متین ایزدی'),
          ],
        },
      };
    default:
      return { title: '', icon: '📄', kind: 'PAGE', doc: { type: 'doc', content: [p()] } };
  }
}

/** Templates open with a matching cover so new pages feel finished. */
const TEMPLATE_COVERS: Record<string, string> = { meeting: 'ink', prd: 'lilac', retro: 'sunset', onboarding: 'mint' };

const listSelect = { id: true, parentId: true, title: true, icon: true, kind: true, orderKey: true, updatedAt: true, meetingAt: true } as const;

@Injectable()
export class DocsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async tree(workspaceId: string, userId: string) {
    await this.access.membership(workspaceId, userId);
    return this.prisma.doc.findMany({ where: { workspaceId, archivedAt: null }, select: listSelect, orderBy: { orderKey: 'asc' } });
  }

  async meetings(workspaceId: string, userId: string, from: Date, to: Date) {
    await this.access.membership(workspaceId, userId);
    return this.prisma.doc.findMany({
      where: { workspaceId, archivedAt: null, kind: 'MEETING', meetingAt: { gte: from, lt: to } },
      select: { ...listSelect, attendeeIds: true },
      orderBy: { meetingAt: 'asc' },
    });
  }

  async create(workspaceId: string, userId: string, dto: CreateDocDto) {
    await this.access.membership(workspaceId, userId, 'MEMBER');
    if (dto.parentId) await this.findIn(dto.parentId, workspaceId);
    const tpl = templateContent(dto.template);
    const last = await this.prisma.doc.findFirst({ where: { workspaceId, parentId: dto.parentId ?? null }, orderBy: { orderKey: 'desc' }, select: { orderKey: true } });
    return this.prisma.doc.create({
      data: {
        workspaceId,
        parentId: dto.parentId,
        title: dto.title ?? tpl.title,
        icon: dto.icon ?? tpl.icon,
        cover: dto.template ? TEMPLATE_COVERS[dto.template] : undefined,
        kind: tpl.kind,
        content: tpl.doc as Prisma.InputJsonValue,
        orderKey: rankBetween(last?.orderKey ?? null, null),
        meetingAt: dto.meetingAt ? new Date(dto.meetingAt) : tpl.kind === 'MEETING' ? new Date() : undefined,
        attendeeIds: dto.attendeeIds ?? (tpl.kind === 'MEETING' ? [userId] : []),
        projectId: dto.projectId,
        createdById: userId,
        updatedById: userId,
      },
      select: listSelect,
    });
  }

  async get(id: string, userId: string) {
    const doc = await this.prisma.doc.findUnique({
      where: { id },
      omit: { ystate: true },
      include: { children: { where: { archivedAt: null }, select: listSelect, orderBy: { orderKey: 'asc' } } },
    });
    if (!doc || doc.archivedAt) throw new NotFoundException('Doc not found');
    const m = await this.access.membership(doc.workspaceId, userId);
    const breadcrumbs: { id: string; title: string; icon: string | null }[] = [];
    let parentId = doc.parentId;
    while (parentId && breadcrumbs.length < 10) {
      const parent = await this.prisma.doc.findUnique({ where: { id: parentId }, select: { id: true, title: true, icon: true, parentId: true } });
      if (!parent) break;
      breadcrumbs.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
      parentId = parent.parentId;
    }
    const people = await this.prisma.user.findMany({ where: { id: { in: [doc.createdById, doc.updatedById] } }, select: { id: true, name: true } });
    return { ...doc, breadcrumbs, canEdit: m.role !== 'VIEWER' && m.role !== 'GUEST', people };
  }

  async update(id: string, userId: string, dto: UpdateDocDto) {
    const doc = await this.find(id);
    await this.access.membership(doc.workspaceId, userId, 'MEMBER');
    const { archived, meetingAt, ...rest } = dto;
    return this.prisma.doc.update({
      where: { id },
      data: {
        ...rest,
        meetingAt: meetingAt === undefined ? undefined : meetingAt === null ? null : new Date(meetingAt),
        archivedAt: archived === undefined ? undefined : archived ? new Date() : null,
        updatedById: userId,
      },
      select: listSelect,
    });
  }

  /** Stores the editor's JSON/plain-text snapshot and records a version at most every 10 minutes. */
  async snapshot(id: string, userId: string, dto: SnapshotDto) {
    const doc = await this.find(id);
    await this.access.membership(doc.workspaceId, userId, 'MEMBER');
    await this.prisma.doc.update({ where: { id }, data: { content: dto.content as Prisma.InputJsonValue, text: dto.text, updatedById: userId } });
    const last = await this.prisma.docVersion.findFirst({ where: { docId: id }, orderBy: { createdAt: 'desc' } });
    if (!last || Date.now() - last.createdAt.getTime() > 10 * 60 * 1000) {
      await this.prisma.docVersion.create({ data: { docId: id, title: doc.title, content: dto.content as Prisma.InputJsonValue, authorId: userId } });
    }
  }

  async versions(id: string, userId: string) {
    const doc = await this.find(id);
    await this.access.membership(doc.workspaceId, userId);
    const items = await this.prisma.docVersion.findMany({ where: { docId: id }, orderBy: { createdAt: 'desc' }, take: 50 });
    const authors = await this.prisma.user.findMany({ where: { id: { in: [...new Set(items.map((v) => v.authorId))] } }, select: { id: true, name: true } });
    return items.map((v) => ({ ...v, author: authors.find((a) => a.id === v.authorId) ?? null }));
  }

  async move(id: string, userId: string, dto: MoveDocDto) {
    const doc = await this.find(id);
    await this.access.membership(doc.workspaceId, userId, 'MEMBER');
    const parentId = dto.parentId === undefined ? doc.parentId : dto.parentId;
    // A page cannot move under itself or its descendants.
    for (let cursor = parentId; cursor; ) {
      if (cursor === id) throw new BadRequestException('Cannot move a page into itself');
      cursor = (await this.prisma.doc.findUnique({ where: { id: cursor }, select: { parentId: true } }))?.parentId ?? null;
    }
    const [before, after] = await Promise.all(
      [dto.beforeId, dto.afterId].map((x) => (x ? this.prisma.doc.findFirst({ where: { id: x, workspaceId: doc.workspaceId }, select: { orderKey: true } }) : null)),
    );
    let orderKey: string;
    if (before && after && before.orderKey < after.orderKey) orderKey = rankBetween(before.orderKey, after.orderKey);
    else if (after) {
      const prev = await this.prisma.doc.findFirst({ where: { workspaceId: doc.workspaceId, parentId, orderKey: { lt: after.orderKey } }, orderBy: { orderKey: 'desc' } });
      orderKey = rankBetween(prev?.orderKey ?? null, after.orderKey);
    } else {
      const last = await this.prisma.doc.findFirst({ where: { workspaceId: doc.workspaceId, parentId, id: { not: id } }, orderBy: { orderKey: 'desc' } });
      orderKey = rankBetween(before?.orderKey ?? last?.orderKey ?? null, null);
    }
    return this.prisma.doc.update({ where: { id }, data: { parentId, orderKey }, select: listSelect });
  }

  async search(workspaceId: string, q: string) {
    return this.prisma.doc.findMany({
      where: { workspaceId, archivedAt: null, OR: [{ title: { contains: q, mode: 'insensitive' } }, { text: { contains: q, mode: 'insensitive' } }] },
      select: listSelect,
      take: 8,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Used by the collaboration gateway. */
  async loadState(id: string, userId: string) {
    const doc = await this.prisma.doc.findUnique({ where: { id }, select: { workspaceId: true, ystate: true, archivedAt: true } });
    if (!doc || doc.archivedAt) throw new NotFoundException('Doc not found');
    const m = await this.access.membership(doc.workspaceId, userId);
    return { state: doc.ystate, canEdit: m.role !== 'VIEWER' && m.role !== 'GUEST' };
  }

  async saveState(id: string, state: Uint8Array) {
    await this.prisma.doc.update({ where: { id }, data: { ystate: Buffer.from(state) } });
  }

  private async find(id: string) {
    const doc = await this.prisma.doc.findUnique({ where: { id }, select: { id: true, workspaceId: true, title: true, parentId: true } });
    if (!doc) throw new NotFoundException('Doc not found');
    return doc;
  }

  private async findIn(id: string, workspaceId: string) {
    const doc = await this.find(id);
    if (doc.workspaceId !== workspaceId) throw new ForbiddenException('Parent belongs to another workspace');
    return doc;
  }
}
