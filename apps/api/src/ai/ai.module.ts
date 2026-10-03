import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { TasksModule } from '../tasks/tasks.module';
import { AI_PROVIDER, createProvider } from './ai.provider';
import { AiService } from './ai.service';
import { PlannerService } from './planner.service';

class ParseDto {
  @IsString() @MaxLength(1000) text!: string;
}

class BreakdownDto {
  @IsOptional() @IsBoolean() apply?: boolean;
}

class MessageDto {
  @IsIn(['user', 'assistant']) role!: 'user' | 'assistant';
  @IsString() @MaxLength(4000) content!: string;
}

class ChatDto {
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => MessageDto) messages!: MessageDto[];
}

class PlanDto {
  @IsString() workspaceId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) start?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) end?: string;
  @IsOptional() @IsBoolean() lunch?: boolean;
}

@Controller()
class AiController {
  constructor(
    private readonly ai: AiService,
    private readonly planner: PlannerService,
  ) {}

  @Get('ai/status')
  status() {
    return this.ai.status();
  }

  @Post('workspaces/:id/ai/parse') @HttpCode(200)
  parse(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ParseDto) {
    return this.ai.parseTask(id, user.id, dto.text);
  }

  @Post('tasks/:id/ai/breakdown') @HttpCode(200)
  breakdown(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: BreakdownDto) {
    return this.ai.breakdown(id, user.id, !!dto.apply);
  }

  @Post('tasks/:id/ai/summary') @HttpCode(200)
  summary(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.summarize(id, user.id);
  }

  @Post('workspaces/:id/ai/chat') @HttpCode(200)
  chat(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ChatDto) {
    return this.ai.chat(id, user.id, dto.messages);
  }

  @Post('workspaces/:id/ai/standup') @HttpCode(200)
  standup(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ai.standup(id, user.id);
  }

  @Get('me/plan')
  getPlan(@CurrentUser() user: AuthUser, @Query('date') date: string) {
    return this.planner.get(user.id, date);
  }

  @Post('me/plan') @HttpCode(200)
  plan(@CurrentUser() user: AuthUser, @Body() dto: PlanDto) {
    return this.planner.plan(dto.workspaceId, user.id, dto);
  }
}

@Module({
  imports: [TasksModule],
  controllers: [AiController],
  providers: [AiService, PlannerService, { provide: AI_PROVIDER, useFactory: createProvider }],
})
export class AiModule {}
