import { randomBytes } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { readCookie } from '../auth/auth-cookie';
import type { AppConfig } from '../config/env';

export const GUEST_CART_COOKIE = 'jf_guest_cart';

export function getOrCreateGuestCartId(
  request: Parameters<typeof readCookie>[0],
  response: Response,
  config: AppConfig,
): string {
  const existing = readCookie(request, GUEST_CART_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{32,64}$/.test(existing)) return existing;

  const guestId = randomBytes(32).toString('base64url');
  response.cookie(GUEST_CART_COOKIE, guestId, {
    ...guestCookieOptions(config),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  return guestId;
}

export function clearGuestCartCookie(response: Response, config: AppConfig): void {
  response.clearCookie(GUEST_CART_COOKIE, guestCookieOptions(config));
}

function guestCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/api',
  };
}
