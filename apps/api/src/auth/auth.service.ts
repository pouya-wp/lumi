import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { LoginDto, RegisterDto, UpdateMeDto } from './auth.dto';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const publicUser = { id: true, email: true, name: true, avatarUrl: true, locale: true, calendar: true, timezone: true } as const;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly workspaces: WorkspacesService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: { email, name: dto.name, locale: dto.locale ?? 'fa', passwordHash: await bcrypt.hash(dto.password, 10) },
      select: publicUser,
    });

    const joined = await this.workspaces.acceptPendingInvites(user.id, email);
    if (joined === 0) {
      await this.workspaces.create(user.id, { name: dto.workspaceName ?? dto.name }, { withStarterProject: true, locale: user.locale });
    }
    return { user, ...(await this.issueTokens(user.id)) };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return { user: await this.me(user.id), ...(await this.issueTokens(user.id)) };
  }

  /** Rotates the refresh token: the presented token is revoked and a new pair is issued. */
  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw new UnauthorizedException();
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(stored.userId);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: publicUser });
  }

  updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: publicUser });
  }

  private async issueTokens(userId: string) {
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    });
    return { accessToken: await this.jwt.signAsync({ sub: userId }), refreshToken };
  }
}
