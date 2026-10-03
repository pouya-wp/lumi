import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
  createParamDecorator,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { CommentsService, CreateCommentDto } from '../comments/comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto, ListTasksQuery, UpdateTaskDto } from '../tasks/tasks.dto';
import { TasksService } from '../tasks/tasks.service';
import { sha256, token } from './crypto';

export class CreateApiKeyDto {
  @IsString() @MinLength(1) @MaxLength(60) name!: string;
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  list(workspaceId: string, userId: string) {
    return this.access.membership(workspaceId, userId).then(() =>
      this.prisma.apiKey.findMany({
        where: { workspaceId, userId, revokedAt: null },
        select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /** Returns the full key exactly once; afterwards only its prefix is visible. */
  async create(workspaceId: string, userId: string, dto: CreateApiKeyDto) {
    await this.access.membership(workspaceId, userId, 'MEMBER');
    const key = token('lumi_', 30);
    const row = await this.prisma.apiKey.create({ data: { workspaceId, userId, name: dto.name, prefix: key.slice(0, 12), hash: sha256(key) } });
    return { id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt, key };
  }

  async revoke(id: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, userId, revokedAt: null } });
    if (!key) throw new NotFoundException('Key not found');
    await this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async resolve(raw: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { hash: sha256(raw) } });
    if (!key || key.revokedAt) return null;
    const member = await this.prisma.membership.findUnique({ where: { userId_workspaceId: { userId: key.userId, workspaceId: key.workspaceId } } });
    if (!member) return null;
    // Touch at most once a minute to avoid a write per request.
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
      await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    }
    return key;
  }
}

export interface ApiKeyContext {
  keyId: string;
  userId: string;
  workspaceId: string;
}

/** Authenticates `Authorization: Bearer lumi_…` (or `X-Api-Key`) for the public API. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly keys: ApiKeysService) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const header = (req.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '') ?? (req.headers['x-api-key'] as string | undefined);
    if (!header?.startsWith('lumi_')) throw new UnauthorizedException('API key required');
    const key = await this.keys.resolve(header);
    if (!key) throw new UnauthorizedException('Invalid API key');
    req.apiKey = { keyId: key.id, userId: key.userId, workspaceId: key.workspaceId } satisfies ApiKeyContext;
    return true;
  }
}

const Key = createParamDecorator((_: unknown, ctx: ExecutionContext): ApiKeyContext => ctx.switchToHttp().getRequest().apiKey);

@Controller()
export class ApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get('workspaces/:id/api-keys')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.keys.list(id, user.id);
  }

  @Post('workspaces/:id/api-keys')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateApiKeyDto) {
    return this.keys.create(id, user.id, dto);
  }

  @Delete('api-keys/:id') @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.keys.revoke(id, user.id);
  }
}

/**
 * Public REST API (v1). A key acts as the member who created it, scoped to the key's workspace,
 * so every call still goes through the normal role checks.
 */
@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class PublicApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
  ) {}

  private async ensureProject(key: ApiKeyContext, projectId: string) {
    const p = await this.prisma.project.findUnique({ where: { id: projectId }, select: { workspaceId: true } });
    if (!p || p.workspaceId !== key.workspaceId) throw new ForbiddenException('Project is outside this key’s workspace');
  }

  private async ensureTask(key: ApiKeyContext, taskId: string) {
    const t = await this.prisma.task.findUnique({ where: { id: taskId }, select: { project: { select: { workspaceId: true } } } });
    if (!t || t.project.workspaceId !== key.workspaceId) throw new NotFoundException('Task not found');
  }

  @Get('me')
  async me(@Key() key: ApiKeyContext) {
    const [user, workspace] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: key.userId }, select: { id: true, name: true, email: true } }),
      this.prisma.workspace.findUniqueOrThrow({ where: { id: key.workspaceId }, select: { id: true, name: true, slug: true } }),
    ]);
    return { user, workspace };
  }

  @Get('projects')
  projects(@Key() key: ApiKeyContext) {
    return this.prisma.project.findMany({
      where: { workspaceId: key.workspaceId, archivedAt: null },
      select: { id: true, key: true, name: true, icon: true, statuses: { select: { id: true, name: true, category: true }, orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  @Get('projects/:id/tasks')
  async listTasks(@Key() key: ApiKeyContext, @Param('id') id: string, @Query() q: ListTasksQuery) {
    await this.ensureProject(key, id);
    return this.tasks.list(id, key.userId, q);
  }

  @Post('projects/:id/tasks')
  async createTask(@Key() key: ApiKeyContext, @Param('id') id: string, @Body() dto: CreateTaskDto) {
    await this.ensureProject(key, id);
    return this.tasks.create(id, key.userId, dto);
  }

  @Get('tasks/:id')
  async getTask(@Key() key: ApiKeyContext, @Param('id') id: string) {
    await this.ensureTask(key, id);
    return this.tasks.get(id, key.userId);
  }

  @Patch('tasks/:id')
  async updateTask(@Key() key: ApiKeyContext, @Param('id') id: string, @Body() dto: UpdateTaskDto) {
    await this.ensureTask(key, id);
    return this.tasks.update(id, key.userId, dto);
  }

  @Post('tasks/:id/comments')
  async comment(@Key() key: ApiKeyContext, @Param('id') id: string, @Body() dto: CreateCommentDto) {
    await this.ensureTask(key, id);
    return this.comments.create(id, key.userId, dto);
  }
}
