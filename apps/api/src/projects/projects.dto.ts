import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Methodology, StatusCategory } from '@lumi/shared';

export class CreateProjectDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @Matches(/^[A-Z][A-Z0-9]{1,5}$/) key?: string;
  @IsOptional() @IsString() @MaxLength(16) icon?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(Methodology, { each: true }) methodology?: string[];
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(16) icon?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsIn(Methodology, { each: true }) methodology?: string[];
  /** When false, tasks assigned to others skip the proposal step. */
  @IsOptional() @IsBoolean() proposals?: boolean;
}

export class CreateStatusDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsIn(StatusCategory) category!: (typeof StatusCategory)[number];
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}

export class UpdateStatusDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsIn(StatusCategory) category?: (typeof StatusCategory)[number];
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
  @IsOptional() @IsInt() order?: number;
}
