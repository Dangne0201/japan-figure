import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { hash } from 'bcryptjs';
import { AppModule } from '../../src/app.module';
import { SameOriginGuard } from '../../src/auth/same-origin.guard';
import { HttpExceptionFilter } from '../../src/common/http-exception.filter';
import { releaseOrderCommitments } from '../../src/commerce/order-lifecycle';
import type { AppConfig } from '../../src/config/env';
import { PrismaService } from '../../src/database/prisma.service';

describe('Storefront API (e2e)', () => {
  let app: INestApplication;
  let ownerEmail: string;
  let otherEmail: string;
  let ownerCookie: string;
  let otherCookie: string;
  let origin: string;
  let createdOrderId: string | undefined;
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

    origin = app.get<AppConfig>('APP_CONFIG').WEB_ORIGIN;
    const prisma = app.get(PrismaService);
    const passwordHash = await hash(password, 4);
    const suffix = randomUUID();
    ownerEmail = `e2e-owner-${suffix}@example.test`;
    otherEmail = `e2e-other-${suffix}@example.test`;
    await prisma.user.createMany({
      data: [
        { email: ownerEmail, name: 'E2E Collector', passwordHash, emailVerifiedAt: new Date() },
        { email: otherEmail, name: 'Other Collector', passwordHash, emailVerifiedAt: new Date() },
      ],
    });
    ownerCookie = await loginAndGetAccessCookie(ownerEmail);
    otherCookie = await loginAndGetAccessCookie(otherEmail);
  });

  afterAll(async () => {
    if (!app) return;
    const prisma = app.get(PrismaService);
    const userIds = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, otherEmail] } },
      select: { id: true },
    });
    const orders = await prisma.order.findMany({
      where: { userId: { in: userIds.map(({ id }) => id) } },
      select: { id: true, userId: true, pointsRedeemed: true },
    });
    for (const order of orders) {
      await prisma.$transaction((transaction) => releaseOrderCommitments(transaction, order));
    }
    await prisma.order.deleteMany({ where: { id: { in: orders.map(({ id }) => id) } } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
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

  it('authenticates customers and returns only their own profile and conversations', async () => {
    const profile = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', ownerCookie)
      .expect(200);

    expect(profile.body.email).toBe(ownerEmail);
    expect(profile.body.name).toBe('E2E Collector');

    const conversation = await request(app.getHttpServer())
      .post('/api/chat/conversations')
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .expect(201);
    const conversationId = conversation.body.id as string;

    const ownConversation = await request(app.getHttpServer())
      .get(`/api/chat/conversations/${conversationId}`)
      .set('Cookie', ownerCookie)
      .expect(200);
    expect(ownConversation.body.id).toBe(conversationId);

    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${conversationId}`)
      .set('Cookie', otherCookie)
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/chat/conversations')
      .set('Cookie', otherCookie)
      .expect(200)
      .expect(({ body }) => expect(body.pagination.total).toBe(0));
  });

  it('places an integer-VND order and applies simulated payment outcomes idempotently', async () => {
    const reference = await request(app.getHttpServer())
      .get('/api/addresses/reference')
      .expect(200);
    const province = reference.body.provinces[0] as { code: string };
    const commune = reference.body.communes.find(
      (item: { provinceCode: string }) => item.provinceCode === province.code,
    ) as { code: string } | undefined;
    if (!commune) throw new Error(`No commune is available for province ${province.code}.`);

    const address = await request(app.getHttpServer())
      .post('/api/addresses')
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .send({
        label: 'E2E',
        recipientName: 'E2E Collector',
        phone: '0912345678',
        streetAddress: '12 Nguyễn Trãi, khu phố 3',
        provinceCode: province.code,
        communeCode: commune.code,
        isDefault: true,
      })
      .expect(201);

    const variant = await app.get(PrismaService).productVariant.findFirst({
      where: {
        product: { publishedAt: { not: null } },
        stockOnHand: { gt: 0 },
      },
      select: { id: true },
    });
    if (!variant) throw new Error('The seeded catalog has no in-stock published variant.');

    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .send({ variantId: variant.id, quantity: 1 })
      .expect(201);

    const quote = await request(app.getHttpServer())
      .post('/api/checkout/quote')
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .send({ addressId: address.body.id })
      .expect(201);
    expect(Number.isSafeInteger(quote.body.amounts.totalVnd)).toBe(true);

    const placed = await request(app.getHttpServer())
      .post('/api/checkout/place')
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .send({ addressId: address.body.id, paymentMethod: 'MOCK_TRANSFER' })
      .expect(201);
    createdOrderId = placed.body.id;
    expect(placed.body.status).toBe('PENDING_PAYMENT');
    expect(placed.body.payment.method).toBe('MOCK_TRANSFER');
    expect(placed.body.payment.amountVnd).toBe(quote.body.amounts.totalVnd);

    await request(app.getHttpServer())
      .post(`/api/orders/${createdOrderId}/payment-outcome`)
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .send({ eventId: 'e2e-payment-event', outcome: 'SUCCESS' })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('PAID'));
    await request(app.getHttpServer())
      .post(`/api/orders/${createdOrderId}/payment-outcome`)
      .set('Cookie', ownerCookie)
      .set('Origin', origin)
      .send({ eventId: 'e2e-payment-event', outcome: 'SUCCESS' })
      .expect(201)
      .expect(({ body }) => expect(body.status).toBe('PAID'));
    await request(app.getHttpServer())
      .get(`/api/orders/${createdOrderId}`)
      .set('Cookie', otherCookie)
      .expect(404);
  });

  async function loginAndGetAccessCookie(userEmail: string): Promise<string> {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: userEmail, password })
      .expect(200);
    const setCookie = login.headers['set-cookie'] as string[] | undefined;
    const accessCookie = setCookie?.find((cookie) => cookie.startsWith('jf_access='));
    if (!accessCookie) throw new Error(`Login did not set the access cookie for ${userEmail}.`);
    const [cookie] = accessCookie.split(';');
    if (!cookie) throw new Error(`Login returned an invalid access cookie for ${userEmail}.`);
    return cookie;
  }
});
