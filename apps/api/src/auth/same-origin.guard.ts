import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth-cookie';
import type { AppConfig } from '../config/env';

const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class SameOriginGuard implements CanActivate {
  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    assertSameOriginForCookieMutation(request, this.config.WEB_ORIGIN);
    return true;
  }
}

export function assertSameOriginForCookieMutation(
  request: Pick<Request, 'method' | 'headers'>,
  webOrigin: string,
): void {
  if (!stateChangingMethods.has(request.method.toUpperCase())) return;

  const cookies = request.headers.cookie ?? '';
  const hasAuthCookie = cookies.split(';').some((cookie) => {
    const name = cookie.slice(0, cookie.indexOf('=')).trim();
    return name === ACCESS_COOKIE || name === REFRESH_COOKIE;
  });
  if (!hasAuthCookie) return;

  const origin = request.headers.origin;
  if (!origin) {
    throw new ForbiddenException('Origin header is required for authenticated changes.');
  }

  let actualOrigin: string;
  try {
    actualOrigin = new URL(origin).origin;
  } catch {
    throw new ForbiddenException('Request origin is not allowed.');
  }

  if (actualOrigin !== new URL(webOrigin).origin) {
    throw new ForbiddenException('Request origin is not allowed.');
  }
}
