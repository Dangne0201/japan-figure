import type { CookieOptions, Request, Response } from 'express';
import type { AppConfig } from '../config/env';

export const ACCESS_COOKIE = 'jf_access';
export const REFRESH_COOKIE = 'jf_refresh';

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;

  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch (error) {
      if (error instanceof URIError) return undefined;
      throw error;
    }
  }
  return undefined;
}

export function setAuthCookies(
  response: Response,
  config: AppConfig,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieOptions(config),
    maxAge: config.AUTH_ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  response.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieOptions(config),
    maxAge: config.AUTH_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(response: Response, config: AppConfig): void {
  response.clearCookie(ACCESS_COOKIE, cookieOptions(config));
  response.clearCookie(REFRESH_COOKIE, cookieOptions(config));
}

function cookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api',
  };
}
