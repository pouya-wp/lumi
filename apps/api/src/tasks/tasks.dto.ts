import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Priority } from '@lumi/shared';

const ASSIGNEE_ROLES = ['ASSIGNEE', 'REVIEWER', 'WATCHER'] as const;
const DEPENDENCY_TYPES = ['BLOCKS', 'RELATES', 'DUPLICATES'] as const;

export class CreateTaskDto {
  @IsString() @MinLength(1) @MaxLength(300) title!: string;
  @IsOptional() @IsObject() description?: Record<string, unknown>;
  @IsOptional() @IsString() statusId?: string;
  @IsOptional() @IsIn(Priority) priority?: (typeof Priority)[number];
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() dueAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100000) estimateMin?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) storyPoints?: number;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) assigneeIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) labelIds?: string[];
  /** Label names to find or create, used by quick-add (#label). */
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) labelNames?: string[];
  @IsOptional() @IsString() @MaxLength(200) recurrence?: string;
  @IsOptional() @IsObject() customFields?: Record<string, unknown>;
  @IsOptional() @IsString() sprintId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @IsOptional() @IsObject() description?: Record<string, unknown>;
  @IsOptional() @IsString() statusId?: string;
  @IsOptional() @IsIn(Priority) priority?: (typeof Priority)[number];
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() startAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString() dueAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) estimateMin?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) storyPoints?: number | null;
  @IsOptional() @IsBoolean() archived?: boolean;
  /** Partial map of custom field id → value; null clears a value. */
  @IsOptional() @IsObject() customFields?: Record<string, unknown>;
  /** RRULE subset (see packages/shared recurrence.ts); null stops repeating. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(200) recurrence?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() sprintId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() milestoneId?: string | null;
}

export class ListTasksQuery {
  @IsOptional() @IsString() statusId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsIn(Priority) priority?: (typeof Priority)[number];
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsIn(['true', 'false']) includeSubtasks?: string;
  @IsOptional() @IsString() labelId?: string;
  /** Comma-separated status categories, e.g. TODO,IN_PROGRESS */
  @IsOptional() @IsString() categories?: string;
}

/** Workspace-wide tasks scheduled within [from, to) — by due date or start..due span. */
export class RangeTasksQuery {
  @IsDateString() from!: string;
  @IsDateString() to!: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsIn(['true', 'false']) includeDone?: string;
}

export class MyTasksQuery {
  @IsOptional() @IsString() workspaceId?: string;
  @IsOptional() @IsIn(['open', 'today', 'overdue', 'upcoming', 'done']) scope?: 'open' | 'today' | 'overdue' | 'upcoming' | 'done';
}

export class MoveTaskDto {
  @IsString() statusId!: string;
  /** Task that should end up directly above the moved task. */
  @IsOptional() @IsString() beforeId?: string;
  /** Task that should end up directly below the moved task. */
  @IsOptional() @IsString() afterId?: string;
}

export class SetAssigneesDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) userIds!: string[];
  @IsOptional() @IsIn(ASSIGNEE_ROLES) role?: (typeof ASSIGNEE_ROLES)[number];
}

export class SetLabelsDto {
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) labelIds!: string[];
}

export class ProposalDto {
  @IsIn(['accept', 'decline', 'counter']) action!: 'accept' | 'decline' | 'counter';
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ValidateIf((o) => o.action === 'counter') @IsDateString() dueAt?: string;
}

export class ChecklistCreateDto {
  @IsString() @MinLength(1) @MaxLength(300) text!: string;
}

export class ChecklistUpdateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) text?: string;
  @IsOptional() @IsBoolean() done?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() order?: number;
}

export class DependencyDto {
  @IsString() toTaskId!: string;
  @IsIn(DEPENDENCY_TYPES) type!: (typeof DEPENDENCY_TYPES)[number];
}
