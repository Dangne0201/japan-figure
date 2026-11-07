import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuthService } from '../src/auth/auth.service';
import type { AppConfig } from '../src/config/env';
import type { PrismaService } from '../src/database/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { AuthMailerService } from '../src/auth/auth-mailer.service';

const config: AppConfig = {
  NODE_ENV: 'test',
  API_PORT: 3001,
  DATABASE_URL: '******localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  WEB_ORIGIN: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
  AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
  AUTH_REFRESH_TOKEN_TTL_DAYS: 30,
  AUTH_ACTION_TOKEN_TTL_HOURS: 24,
  COOKIE_SECURE: false,
  SMTP_HOST: 'localhost',
  SMTP_PORT: 1025,
  MAIL_FROM: 'no-reply@japan-figure.local',
  OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
  OLLAMA_CHAT_MODEL: 'test-chat',
  OLLAMA_CHAT_FALLBACK_MODEL: 'test-fallback',
  OLLAMA_EMBEDDING_MODEL: 'test-embedding',
  LLM_PROVIDER: 'ollama',
  LLM_REQUEST_TIMEOUT_MS: 30_000,
  LLM_RETRY_COUNT: 2,
  GEMINI_CHAT_MODEL: 'test-gemini',
  KNOWLEDGE_RELEVANCE_THRESHOLD: 0.42,
  KNOWLEDGE_TOP_K: 5,
  PRODUCT_UPLOAD_DIR: '/tmp/product-uploads',
};

const currentUser = {
  id: 'user-1',
  email: 'collector@example.com',
  name: 'Figure Collector',
  role: UserRole.USER,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  disabledAt: null,
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService', () => {
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-access-token') };
  const mailer = {
    sendVerification: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
  };

  afterEach(() => jest.clearAllMocks());

  it('rejects passwords longer than bcrypt can safely compare', async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mailer as unknown as AuthMailerService,
      config,
    );

    await expect(service.login('collector@example.com', 'é'.repeat(37))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rotates a valid refresh token and persists only its SHA-256 hash', async () => {
    const nextSession = {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: currentUser.id,
          familyId: 'family-1',
          tokenHash: hashToken('old-refresh-token'),
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          user: currentUser,
        }),
      },
      $transaction: jest.fn(async (callback: (transaction: unknown) => Promise<boolean>) =>
        callback({ refreshSession: nextSession }),
      ),
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mailer as unknown as AuthMailerService,
      config,
    );

    const result = await service.refresh('old-refresh-token');

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).not.toBe('old-refresh-token');
    expect(nextSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: currentUser.id,
        familyId: 'family-1',
        tokenHash: hashToken(result.refreshToken),
      }),
    });
    expect(result.user.email).toBe(currentUser.email);
  });

  it('revokes the active token family when a previously consumed token is reused', async () => {
    const revokeFamily = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          familyId: 'family-1',
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 60_000),
          user: currentUser,
        }),
        updateMany: revokeFamily,
      },
    };
    const service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      mailer as unknown as AuthMailerService,
      config,
    );

    await expect(service.refresh('replayed-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshSession.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('replayed-token') },
      include: { user: true },
    });
    expect(revokeFamily).toHaveBeenCalledWith({
      where: { familyId: 'family-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
