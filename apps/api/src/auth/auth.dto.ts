import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @IsOptional() @IsString() @MaxLength(60) workspaceName?: string;
  @IsOptional() @IsIn(['fa', 'en']) locale?: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() password!: string;
}

export class RefreshDto {
  @IsString() refreshToken!: string;
}

export class UpdateMeDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60) name?: string;
  @IsOptional() @IsIn(['fa', 'en']) locale?: string;
  @IsOptional() @IsIn(['jalali', 'gregorian']) calendar?: 'jalali' | 'gregorian';
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() avatarUrl?: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
