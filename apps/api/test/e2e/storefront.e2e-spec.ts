import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { hash } from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { SameOriginGuard } from '../../src/auth/same-origin.guard';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';
import { PrismaService } from '../../src/database/prisma.service';

describe('Storefront API (e2e)', () => {
  let app: INestApplication;
  let email: string;
  const password = 'e2e-password-for-auth-flow';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalGuards(app.get(SameOriginGuard));
    await app.init();

    email = `e2e-${randomUUID()}@example.test`;
    await app.get(PrismaService).user.create({
      data: {
        email,
        name: 'E2E Collector',
        passwordHash: await hash(password, 4),
        emailVerifiedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (!app) return;
    await app.get(PrismaService).user.deleteMany({ where: { email } });
    await app.close();
  });

  it('serves dependency health through the HTTP application', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.checks.database.status).toBe('up');
    expect(response.body.checks.redis.status).toBe('up');
  });

  it('lists and loads a published product from PostgreSQL', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/catalog/products')
      .query({ limit: 1 })
      .expect(200);

    expect(list.body.items).toHaveLength(1);
    expect(list.body.pagination.total).toBeGreaterThanOrEqual(50);

    const product = await request(app.getHttpServer())
      .get(`/api/catalog/products/${list.body.items[0].slug}`)
      .expect(200);

    expect(product.body.product.slug).toBe(list.body.items[0].slug);
    expect(product.body.product.variants.length).toBeGreaterThan(0);
  });

  it('authenticates a customer, sets cookies, and serves the protected profile', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    const setCookie = login.headers['set-cookie'] as string[] | undefined;
    const accessCookie = setCookie?.find((cookie) => cookie.startsWith('jf_access='));
    if (!accessCookie) throw new Error('Login did not set the access cookie.');
    const [accessTokenCookie] = accessCookie.split(';');
    if (!accessTokenCookie) throw new Error('Login returned an invalid access cookie.');

    const profile = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', accessTokenCookie)
      .expect(200);

    expect(profile.body.email).toBe(email);
    expect(profile.body.name).toBe('E2E Collector');
  });
});
