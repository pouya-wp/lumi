import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'GUEST', 'VIEWER'] as const;

export class CreateWorkspaceDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
}

export class UpdateWorkspaceDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
}

export class InviteDto {
  @IsEmail() email!: string;
  @IsOptional() @IsIn(ASSIGNABLE_ROLES) role?: (typeof ASSIGNABLE_ROLES)[number];
}

export class UpdateMemberDto {
  @IsIn(ASSIGNABLE_ROLES) role!: (typeof ASSIGNABLE_ROLES)[number];
}

export class CreateLabelDto {
  @IsString() @MinLength(1) @MaxLength(32) name!: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) color?: string;
}
