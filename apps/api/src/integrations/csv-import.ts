import { Body, Controller, HttpCode, Injectable, Param, Post } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

export class ImportCsvDto {
  @IsString() @MaxLength(2_000_000) csv!: string;
  @IsOptional() @IsBoolean() dryRun?: boolean;
}

/** RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, commas or semicolons/tabs as separators. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const sep = [',', ';', '\t'].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/** Header aliases from Lumi, Jira, Trello, Asana, ClickUp and Persian exports. */
const COLUMNS: Record<string, string[]> = {
  title: ['title', 'summary', 'name', 'task', 'task name', 'card name', 'عنوان', 'نام'],
  description: ['description', 'desc', 'notes', 'details', 'توضیحات'],
  priority: ['priority', 'اولویت'],
  due: ['due', 'due date', 'duedate', 'dueat', 'deadline', 'due on', 'ددلاین', 'موعد', 'تاریخ'],
  assignees: ['assignee', 'assignees', 'owner', 'assigned to', 'members', 'مسئول', 'انجام‌دهنده'],
  labels: ['labels', 'label', 'tags', 'tag', 'برچسب', 'برچسب‌ها'],
  status: ['status', 'state', 'list', 'section', 'column', 'وضعیت'],
  estimate: ['estimate', 'estimate (min)', 'estimatemin', 'original estimate', 'تخمین'],
  points: ['story points', 'storypoints', 'points', 'امتیاز'],
};

const PRIORITIES: [RegExp, 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'][] = [
  [/urgent|highest|critical|blocker|p0|فوری|بحرانی/i, 'URGENT'],
  [/high|major|p1|بالا|مهم/i, 'HIGH'],
  [/medium|normal|p2|متوسط|معمولی/i, 'MEDIUM'],
  [/low|minor|trivial|lowest|p3|کم|پایین/i, 'LOW'],
];

const STATUS_WORDS: [RegExp, string][] = [
  [/done|closed|complete|resolved|انجام|تمام|بسته/i, 'DONE'],
  [/progress|doing|in dev|active|در حال/i, 'IN_PROGRESS'],
  [/review|qa|test|بازبینی/i, 'REVIEW'],
  [/backlog|بک‌?لاگ/i, 'BACKLOG'],
  [/to ?do|open|new|برای انجام/i, 'TODO'],
];

@Injectable()
export class CsvImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly tasks: TasksService,
  ) {}

  async import(projectId: string, userId: string, dto: ImportCsvDto) {
    const project = await this.access.project(projectId, userId, 'MEMBER');
    const rows = parseCsv(dto.csv);
    if (rows.length < 2) return { created: 0, skipped: 0, errors: [{ row: 0, message: 'No data rows' }], columns: {}, preview: [] };
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const col: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(COLUMNS)) {
      const i = header.findIndex((h) => aliases.includes(h));
      if (i >= 0) col[field] = i;
    }
    if (col.title === undefined) return { created: 0, skipped: rows.length - 1, errors: [{ row: 1, message: 'Missing a title/summary/name column' }], columns: col, preview: [] };

    const [statuses, members] = await Promise.all([
      this.prisma.status.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
      this.prisma.membership.findMany({ where: { workspaceId: project.workspaceId }, include: { user: { select: { id: true, email: true, name: true } } } }),
    ]);
    const cell = (r: string[], f: string) => (col[f] === undefined ? '' : (r[col[f]] ?? '').trim());
    const errors: { row: number; message: string }[] = [];
    const items = rows.slice(1, 1001).map((r, idx) => {
      const rowNo = idx + 2;
      const title = cell(r, 'title').slice(0, 300);
      const pr = cell(r, 'priority');
      const priority = PRIORITIES.find(([re]) => re.test(pr))?.[1];
      const dueRaw = cell(r, 'due');
      const due = dueRaw ? new Date(dueRaw) : undefined;
      if (dueRaw && Number.isNaN(due!.getTime())) errors.push({ row: rowNo, message: `Unreadable date “${dueRaw}”` });
      const who = cell(r, 'assignees')
        .split(/[;,|]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const assigneeIds = members.filter((m) => who.some((w) => w === m.user.email.toLowerCase() || w === m.user.name.toLowerCase())).map((m) => m.user.id);
      const st = cell(r, 'status');
      const status =
        statuses.find((s) => s.name.toLowerCase() === st.toLowerCase()) ??
        (st ? statuses.find((s) => s.category === STATUS_WORDS.find(([re]) => re.test(st))?.[1]) : undefined);
      const est = Number(cell(r, 'estimate'));
      const pts = Number(cell(r, 'points'));
      return {
        rowNo,
        title,
        dto: {
          title,
          description: cell(r, 'description') ? { text: cell(r, 'description') } : undefined,
          priority,
          dueAt: due && !Number.isNaN(due.getTime()) ? due.toISOString() : undefined,
          assigneeIds,
          labelNames: cell(r, 'labels')
            .split(/[;,|]/)
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 10),
          statusId: status?.id,
          estimateMin: Number.isFinite(est) && est > 0 ? Math.round(est) : undefined,
          storyPoints: Number.isFinite(pts) && pts > 0 ? Math.min(100, Math.round(pts)) : undefined,
        },
      };
    });

    const valid = items.filter((i) => i.title);
    const skipped = items.length - valid.length;
    if (dto.dryRun) return { created: 0, skipped, errors, columns: col, preview: valid.slice(0, 8).map((i) => ({ row: i.rowNo, ...i.dto })) };

    let created = 0;
    for (const item of valid) {
      try {
        await this.tasks.create(projectId, userId, item.dto);
        created++;
      } catch (e) {
        errors.push({ row: item.rowNo, message: e instanceof Error ? e.message : String(e) });
      }
    }
    return { created, skipped, errors, columns: col, preview: [] };
  }
}

@Controller()
export class CsvImportController {
  constructor(private readonly csv: CsvImportService) {}

  @Post('projects/:id/import') @HttpCode(200)
  import(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ImportCsvDto) {
    return this.csv.import(id, user.id, dto);
  }
}
