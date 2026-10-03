import { Controller, Get, Header, Injectable, NotFoundException, Param, Post } from '@nestjs/common';
import { AccessService } from '../common/access.service';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { publicApiUrl, token } from './crypto';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** Folds content lines to 75 octets as RFC 5545 requires (UTF-8 aware). */
export function fold(line: string) {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/**
 * Private, read-only iCalendar feed per member: their dated tasks as all-day (or timed when a
 * start exists) events plus the meetings they attend. Subscribe from Google/Apple Calendar.
 */
@Injectable()
export class IcalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  private url(t: string) {
    return `${publicApiUrl()}/api/ical/${t}.ics`;
  }

  async feed(workspaceId: string, userId: string, rotate = false) {
    await this.access.membership(workspaceId, userId);
    const existing = await this.prisma.calendarFeed.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (existing && !rotate) return { url: this.url(existing.token) };
    const t = token('', 24);
    await this.prisma.calendarFeed.upsert({ where: { workspaceId_userId: { workspaceId, userId } }, create: { workspaceId, userId, token: t }, update: { token: t } });
    return { url: this.url(t) };
  }

  async render(file: string) {
    const feed = await this.prisma.calendarFeed.findUnique({ where: { token: file.replace(/\.ics$/, '') } });
    if (!feed) throw new NotFoundException();
    const member = await this.prisma.membership.findUnique({ where: { userId_workspaceId: { userId: feed.userId, workspaceId: feed.workspaceId } } });
    if (!member) throw new NotFoundException();
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [workspace, tasks, meetings] = await Promise.all([
      this.prisma.workspace.findUniqueOrThrow({ where: { id: feed.workspaceId }, select: { name: true } }),
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          archivedAt: null,
          dueAt: { not: null, gte: since },
          project: { workspaceId: feed.workspaceId, archivedAt: null },
          assignees: { some: { userId: feed.userId, role: 'ASSIGNEE' } },
          status: { category: { not: 'CANCELED' } },
        },
        include: { project: { select: { key: true, name: true } }, status: { select: { name: true, category: true } } },
        take: 1000,
      }),
      this.prisma.doc.findMany({
        where: { workspaceId: feed.workspaceId, kind: 'MEETING', archivedAt: null, meetingAt: { gte: since }, attendeeIds: { has: feed.userId } },
        select: { id: true, title: true, meetingAt: true, updatedAt: true },
      }),
    ]);

    const web = (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Beyondex//Lumi//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(`Lumi · ${workspace.name}`)}`, 'X-WR-TIMEZONE:Asia/Tehran'];
    for (const t of tasks) {
      const done = t.status.category === 'DONE';
      lines.push('BEGIN:VEVENT', `UID:task-${t.id}@lumi`, `DTSTAMP:${stamp(t.updatedAt)}`);
      if (t.startAt && t.startAt < t.dueAt!) {
        lines.push(`DTSTART:${stamp(t.startAt)}`, `DTEND:${stamp(t.dueAt!)}`);
      } else {
        const next = new Date(t.dueAt!);
        next.setDate(next.getDate() + 1);
        lines.push(`DTSTART;VALUE=DATE:${dateOnly(t.dueAt!)}`, `DTEND;VALUE=DATE:${dateOnly(next)}`);
      }
      lines.push(
        `SUMMARY:${esc(`${done ? '✓ ' : ''}${t.project.key}-${t.number} ${t.title}`)}`,
        `DESCRIPTION:${esc(`${t.project.name} · ${t.status.name}`)}`,
        `URL:${web}/fa/app/my-tasks?task=${t.id}`,
        `STATUS:${done ? 'CONFIRMED' : 'TENTATIVE'}`,
        'END:VEVENT',
      );
    }
    for (const m of meetings) {
      const end = new Date(m.meetingAt!.getTime() + 60 * 60_000);
      lines.push(
        'BEGIN:VEVENT',
        `UID:meeting-${m.id}@lumi`,
        `DTSTAMP:${stamp(m.updatedAt)}`,
        `DTSTART:${stamp(m.meetingAt!)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(`🗓️ ${m.title}`)}`,
        `URL:${web}/fa/app/docs/${m.id}`,
        'END:VEVENT',
      );
    }
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }
}

@Controller()
export class IcalController {
  constructor(private readonly ical: IcalService) {}

  @Get('workspaces/:id/calendar-feed')
  feed(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ical.feed(id, user.id);
  }

  @Post('workspaces/:id/calendar-feed/rotate')
  rotate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ical.feed(id, user.id, true);
  }

  @Public()
  @Get('ical/:file')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  @Header('Cache-Control', 'private, max-age=300')
  render(@Param('file') file: string) {
    return this.ical.render(file);
  }
}
