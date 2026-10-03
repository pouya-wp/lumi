import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { CreateLabelDto, CreateWorkspaceDto, InviteDto, UpdateMemberDto, UpdateWorkspaceDto } from './workspaces.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspaces.get(id, user.id);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaces.update(id, user.id, dto);
  }

  @Post(':id/invites')
  invite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: InviteDto) {
    return this.workspaces.invite(id, user.id, dto);
  }

  @Delete(':id/invites/:inviteId') @HttpCode(204)
  revokeInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('inviteId') inviteId: string) {
    return this.workspaces.revokeInvite(id, user.id, inviteId);
  }

  @Patch(':id/members/:memberId') @HttpCode(204)
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.workspaces.updateMember(id, user.id, memberId, dto);
  }

  @Delete(':id/members/:memberId') @HttpCode(204)
  removeMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('memberId') memberId: string) {
    return this.workspaces.removeMember(id, user.id, memberId);
  }

  @Get(':id/labels')
  labels(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.workspaces.labels(id, user.id);
  }

  @Post(':id/labels')
  createLabel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateLabelDto) {
    return this.workspaces.createLabel(id, user.id, dto);
  }
}
