import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AppConfig } from '../src/config/env';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService, type AuthTokens } from '../src/auth/auth.service';
import { CartService } from '../src/cart/cart.service';

describe('AuthController', () => {
  let app: INestApplication;
  const user = {
    id: 'user-1',
    email: 'collector@example.com',
    name: 'Figure Collector',
    role: 'USER' as const,
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const tokens: AuthTokens = {
    user,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  };
  const auth = {
    register: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(tokens),
    refresh: jest.fn().mockResolvedValue(tokens),
    logout: jest.fn().mockResolvedValue(undefined),
    verifyEmail: jest.fn().mockResolvedValue(undefined),
    resendVerification: jest.fn().mockResolvedValue(undefined),
    requestPasswordReset: jest.fn().mockResolvedValue(undefined),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    getProfile: jest.fn().mockResolvedValue(user),
    updateProfile: jest.fn().mockResolvedValue(user),
  };
  const carts = { mergeGuestCart: jest.fn().mockResolvedValue(undefined) };
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
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: CartService, useValue: carts },
        { provide: 'APP_CONFIG', useValue: config },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate: (context: { switchToHttp(): { getRequest(): { user: typeof user } } }) => {
          context.switchToHttp().getRequest().user = user;
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    auth.login.mockResolvedValue(tokens);
    auth.refresh.mockResolvedValue(tokens);
    carts.mergeGuestCart.mockResolvedValue(undefined);
  });

  it('validates registration input and returns a Mailpit verification message', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: '  COLLECTOR@example.com ', name: 'Collector', password: 'a-secure-password' })
      .expect(202)
      .expect(({ body }) => {
        expect(body.message).toContain('Mailpit');
      });

    expect(auth.register).toHaveBeenCalledWith({
      email: 'collector@example.com',
      name: 'Collector',
      password: 'a-secure-password',
    });
  });

  it('sets scoped HttpOnly cookies on login and rotates the refresh cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'a-secure-password' })
      .expect(200);
    const cookieHeader = login.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
    expect(cookies).toHaveLength(2);
    expect(cookies.join(';')).toContain('HttpOnly');
    expect(cookies.join(';')).toContain('Path=/api');
    expect(login.body.user.email).toBe(user.email);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', 'jf_refresh=refresh-token')
      .expect(200);
    expect(auth.refresh).toHaveBeenCalledWith('refresh-token');
  });

  it('preserves password whitespace when validating login input', async () => {
    const password = '  secure-password  ';
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password })
      .expect(200);

    expect(auth.login).toHaveBeenCalledWith(user.email, password);
  });

  it('rejects whitespace-only profile names after normalization', async () => {
    await request(app.getHttpServer()).patch('/api/auth/profile').send({ name: '   ' }).expect(400);

    expect(auth.updateProfile).not.toHaveBeenCalled();
  });

  it('clears stale cookies when refresh rejects a reused token', async () => {
    auth.refresh.mockRejectedValueOnce(new UnauthorizedException('Phiên đăng nhập không hợp lệ.'));

    const response = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', 'jf_refresh=old-token')
      .expect(401);

    const clearCookieHeader = response.headers['set-cookie'];
    const clearCookies = Array.isArray(clearCookieHeader)
      ? clearCookieHeader
      : clearCookieHeader
        ? [clearCookieHeader]
        : [];
    expect(clearCookies.join(';')).toContain('Expires=Thu, 01 Jan 1970');
  });

  it('serves the authenticated profile and clears cookies on logout', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerifiedAt: user.emailVerifiedAt.toISOString(),
        });
      });
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', 'jf_refresh=refresh-token')
      .expect(204);
    expect(auth.logout).toHaveBeenCalledWith('refresh-token');
  });
});
