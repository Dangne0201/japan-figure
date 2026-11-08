import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthActionType, Prisma, User, UserRole } from '../generated/prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { AppConfig } from '../config/env';
import { AuthMailerService } from './auth-mailer.service';
import type { AuthenticatedUser } from './auth.types';

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  emailVerifiedAt: true,
} satisfies Prisma.UserSelect;

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailer: AuthMailerService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  async register(input: { email: string; name: string; password: string }): Promise<void> {
    assertPasswordBytes(input.password);
    const email = normalizeEmail(input.email);
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('Email này đã được đăng ký.');

    const user = await this.prisma.user
      .create({
        data: {
          email,
          name: input.name.trim(),
          passwordHash: await hash(input.password, 12),
        },
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Email này đã được đăng ký.');
        }
        throw error;
      });
    await this.sendActionToken(user, AuthActionType.EMAIL_VERIFICATION);
  }

  async login(emailInput: string, password: string): Promise<AuthTokens> {
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(emailInput) },
    });
    const passwordMatches = user ? await compare(password, user.passwordHash) : false;
    if (!user || !passwordMatches || user.disabledAt) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Vui lòng xác minh email trước khi đăng nhập.');
    }
    return this.issueTokens(user);
  }

  async refresh(rawToken: string): Promise<AuthTokens> {
    const tokenHash = hashToken(rawToken);
    const current = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!current) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');

    const now = new Date();
    if (current.revokedAt) {
      await this.revokeFamily(current.familyId, now);
      throw new UnauthorizedException('Phiên đăng nhập đã được sử dụng hoặc đã bị thu hồi.');
    }
    if (current.expiresAt <= now) {
      await this.prisma.refreshSession.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
    }
    if (current.user.disabledAt || !current.user.emailVerifiedAt) {
      await this.revokeFamily(current.familyId, now);
      throw new UnauthorizedException('Tài khoản không thể tiếp tục phiên đăng nhập.');
    }

    const nextToken = createOpaqueToken();
    const nextExpiry = addDays(now, this.config.AUTH_REFRESH_TOKEN_TTL_DAYS);
    const rotated = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.refreshSession.updateMany({
        where: { id: current.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (consumed.count !== 1) {
        await transaction.refreshSession.updateMany({
          where: { familyId: current.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return false;
      }
      await transaction.refreshSession.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: hashToken(nextToken),
          expiresAt: nextExpiry,
        },
      });
      return true;
    });
    if (!rotated) {
      throw new UnauthorizedException('Phiên đăng nhập đã được sử dụng hoặc đã bị thu hồi.');
    }

    return {
      user: toAuthenticatedUser(current.user),
      accessToken: await this.signAccessToken(current.user),
      refreshToken: nextToken,
    };
  }

  async logout(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user?.emailVerifiedAt) throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    return toAuthenticatedUser(user);
  }

  async updateProfile(userId: string, name: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: userSelect,
    });
    if (!user.emailVerifiedAt) throw new UnauthorizedException('Tài khoản chưa được xác minh.');
    return toAuthenticatedUser(user);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const action = await this.findActionToken(rawToken, AuthActionType.EMAIL_VERIFICATION);
    const now = new Date();
    const consumed = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.authActionToken.updateMany({
        where: { id: action.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (result.count !== 1) return false;
      await transaction.user.updateMany({
        where: { id: action.userId, emailVerifiedAt: null, disabledAt: null },
        data: { emailVerifiedAt: now },
      });
      return true;
    });
    if (!consumed) throw new BadRequestException('Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
  }

  async resendVerification(emailInput: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(emailInput) },
    });
    if (!user || user.emailVerifiedAt || user.disabledAt) return;
    await this.sendActionToken(user, AuthActionType.EMAIL_VERIFICATION);
  }

  async requestPasswordReset(emailInput: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(emailInput) },
    });
    if (!user || user.disabledAt) return;
    await this.sendActionToken(user, AuthActionType.PASSWORD_RESET);
  }

  async resetPassword(rawToken: string, password: string): Promise<void> {
    assertPasswordBytes(password);
    const action = await this.findActionToken(rawToken, AuthActionType.PASSWORD_RESET);
    const now = new Date();
    const passwordHash = await hash(password, 12);
    const consumed = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.authActionToken.updateMany({
        where: { id: action.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (result.count !== 1) return false;
      await transaction.user.update({
        where: { id: action.userId },
        data: { passwordHash },
      });
      await transaction.refreshSession.updateMany({
        where: { userId: action.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
    if (!consumed)
      throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const refreshToken = createOpaqueToken();
    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        familyId: createOpaqueToken(15),
        tokenHash: hashToken(refreshToken),
        expiresAt: addDays(new Date(), this.config.AUTH_REFRESH_TOKEN_TTL_DAYS),
      },
    });
    return {
      user: toAuthenticatedUser(user),
      accessToken: await this.signAccessToken(user),
      refreshToken,
    };
  }

  private async signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload);
  }

  private async sendActionToken(user: User, type: AuthActionType): Promise<void> {
    const rawToken = createOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.authActionToken.updateMany({
        where: { userId: user.id, type, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.authActionToken.create({
        data: {
          userId: user.id,
          type,
          tokenHash: hashToken(rawToken),
          expiresAt: addHours(new Date(), this.config.AUTH_ACTION_TOKEN_TTL_HOURS),
        },
      }),
    ]);

    if (type === AuthActionType.EMAIL_VERIFICATION) {
      await this.mailer.sendVerification(user.email, user.name, rawToken);
    } else {
      await this.mailer.sendPasswordReset(user.email, user.name, rawToken);
    }
  }

  private async findActionToken(rawToken: string, type: AuthActionType) {
    const action = await this.prisma.authActionToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    if (!action || action.type !== type || action.consumedAt || action.expiresAt <= new Date()) {
      throw new BadRequestException('Liên kết không hợp lệ hoặc đã hết hạn.');
    }
    return action;
  }

  private async revokeFamily(familyId: string, revokedAt: Date): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt },
    });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function assertPasswordBytes(password: string): void {
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new BadRequestException('Mật khẩu không được vượt quá 72 byte UTF-8.');
  }
}

function toAuthenticatedUser(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
}): AuthenticatedUser {
  if (!user.emailVerifiedAt) throw new UnauthorizedException('Email chưa được xác minh.');
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}
