import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { readCookie, ACCESS_COOKIE } from './auth-cookie';
import type { AuthenticatedUser } from './auth.types';
import { UserRole } from '@prisma/client';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<import('express').Request & { user?: AuthenticatedUser }>();
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) throw new UnauthorizedException('Vui lòng đăng nhập.');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      !Object.values(UserRole).includes(payload.role)
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerifiedAt: true,
        disabledAt: true,
      },
    });
    if (!user || !user.emailVerifiedAt || user.disabledAt) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }

    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt,
    };
    return true;
  }
}

@Injectable()
export class OptionalAccessTokenGuard extends AccessTokenGuard {
  constructor(jwt: JwtService, prisma: PrismaService) {
    super(jwt, prisma);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<import('express').Request>();
    if (!readCookie(request, ACCESS_COOKIE)) return true;
    return super.canActivate(context);
  }
}
