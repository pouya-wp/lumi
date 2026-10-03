import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type CustomField, type FieldType } from '@prisma/client';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../common/access.service';
import { PrismaService } from '../prisma/prisma.service';

const FIELD_TYPES = ['TEXT', 'NUMBER', 'MONEY', 'DATE', 'SELECT', 'MULTI_SELECT', 'USER', 'CHECKBOX', 'URL', 'PROGRESS', 'RATING'] as const;
const OPTION_COLORS = ['#4F5BFF', '#F43F5E', '#16A34A', '#F97316', '#EAB308', '#8B5CF6', '#0EA5E9'];

export class CreateFieldDto {
  @IsString() @MinLength(1) @MaxLength(40) name!: string;
  @IsIn(FIELD_TYPES) type!: FieldType;
  /** Option names for SELECT / MULTI_SELECT. */
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @IsOptional() @IsString() currency?: string;
}

export class UpdateFieldDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(40) name?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @IsOptional() @IsInt() order?: number;
}

type SelectOption = { id: string; name: string; color: string };

function toOptions(names: string[], existing: SelectOption[] = []): SelectOption[] {
  return names.map((name, i) => existing.find((o) => o.name === name) ?? { id: Math.random().toString(36).slice(2, 10), name, color: OPTION_COLORS[i % OPTION_COLORS.length] });
}

/** Validates and normalizes one custom field value; null clears it. */
export function coerceFieldValue(field: CustomField, value: unknown, memberIds: Set<string>): unknown {
  if (value === null || value === undefined || value === '') return null;
  const fail = () => {
    throw new BadRequestException(`Invalid value for field "${field.name}"`);
  };
  const options = ((field.options as { items?: SelectOption[] } | null)?.items ?? []).map((o) => o.id);
  switch (field.type) {
    case 'TEXT':
      return typeof value === 'string' && value.length <= 2000 ? value : fail();
    case 'URL':
      return typeof value === 'string' && /^https?:\/\/\S+$/.test(value) ? value : fail();
    case 'NUMBER':
    case 'MONEY':
      return typeof value === 'number' && Number.isFinite(value) ? value : fail();
    case 'PROGRESS':
      return typeof value === 'number' && value >= 0 && value <= 100 ? Math.round(value) : fail();
    case 'RATING':
      return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5 ? value : fail();
    case 'CHECKBOX':
      return typeof value === 'boolean' ? value : fail();
    case 'DATE':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fail();
    case 'SELECT':
      return typeof value === 'string' && options.includes(value) ? value : fail();
    case 'MULTI_SELECT':
      return Array.isArray(value) && value.every((v) => options.includes(v)) ? [...new Set(value)] : fail();
    case 'USER':
      return typeof value === 'string' && memberIds.has(value) ? value : fail();
  }
}

@Injectable()
export class FieldsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(projectId: string, userId: string) {
    await this.access.project(projectId, userId);
    return this.prisma.customField.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
  }

  async create(projectId: string, userId: string, dto: CreateFieldDto) {
    await this.access.project(projectId, userId, 'MEMBER');
    const last = await this.prisma.customField.findFirst({ where: { projectId }, orderBy: { order: 'desc' } });
    const options =
      dto.type === 'SELECT' || dto.type === 'MULTI_SELECT'
        ? { items: toOptions(dto.options ?? []) }
        : dto.type === 'MONEY'
          ? { currency: dto.currency ?? 'IRT' }
          : undefined;
    return this.prisma.customField.create({
      data: { projectId, name: dto.name, type: dto.type, options: options as Prisma.InputJsonValue | undefined, order: (last?.order ?? -1) + 1 },
    });
  }

  async update(fieldId: string, userId: string, dto: UpdateFieldDto) {
    const field = await this.find(fieldId);
    await this.access.project(field.projectId, userId, 'MEMBER');
    const current = (field.options as { items?: SelectOption[] } | null)?.items;
    return this.prisma.customField.update({
      where: { id: fieldId },
      data: {
        name: dto.name,
        order: dto.order,
        options: dto.options ? ({ ...((field.options as object) ?? {}), items: toOptions(dto.options, current) } as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async remove(fieldId: string, userId: string) {
    const field = await this.find(fieldId);
    await this.access.project(field.projectId, userId, 'MEMBER');
    await this.prisma.customField.delete({ where: { id: fieldId } });
  }

  private async find(id: string) {
    const field = await this.prisma.customField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException('Field not found');
    return field;
  }
}
