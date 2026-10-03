import { Body, Controller, Delete, Get, HttpCode, Module, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { CollabGateway } from './collab.gateway';
import { CreateDocDto, DocsService, MoveDocDto, SnapshotDto, UpdateDocDto } from './docs.service';

@Controller()
class DocsController {
  constructor(private readonly docs: DocsService) {}

  @Get('workspaces/:id/docs')
  tree(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.docs.tree(id, user.id);
  }

  @Get('workspaces/:id/meetings')
  meetings(@CurrentUser() user: AuthUser, @Param('id') id: string, @Query('from') from: string, @Query('to') to: string) {
    return this.docs.meetings(id, user.id, new Date(from), new Date(to));
  }

  @Post('workspaces/:id/docs')
  create(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateDocDto) {
    return this.docs.create(id, user.id, dto);
  }

  @Get('docs/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.docs.get(id, user.id);
  }

  @Patch('docs/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateDocDto) {
    return this.docs.update(id, user.id, dto);
  }

  @Delete('docs/:id') @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.docs.update(id, user.id, { archived: true });
  }

  @Post('docs/:id/snapshot') @HttpCode(204)
  snapshot(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SnapshotDto) {
    return this.docs.snapshot(id, user.id, dto);
  }

  @Get('docs/:id/versions')
  versions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.docs.versions(id, user.id);
  }

  @Post('docs/:id/move') @HttpCode(200)
  move(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: MoveDocDto) {
    return this.docs.move(id, user.id, dto);
  }
}

@Module({ controllers: [DocsController], providers: [DocsService, CollabGateway], exports: [DocsService] })
export class DocsModule {}
