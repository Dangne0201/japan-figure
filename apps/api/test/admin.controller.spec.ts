import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import request from 'supertest';
import { AccessTokenGuard } from '../src/auth/access-token.guard';
import { AdminController } from '../src/admin/admin.controller';
import { AdminOperationsService } from '../src/admin/admin-operations.service';
import { AdminService } from '../src/admin/admin.service';
import { RolesGuard } from '../src/auth/roles.guard';

describe('AdminController authorization', () => {
  let app: INestApplication;
  let role: UserRole = UserRole.USER;
  const admin = { dashboard: jest.fn().mockResolvedValue({ products: 4 }) };
  const operations = { listOrders: jest.fn().mockResolvedValue({ items: [], pagination: {} }) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        RolesGuard,
        { provide: AdminService, useValue: admin },
        { provide: AdminOperationsService, useValue: operations },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp(): { getRequest(): { user: { id: string; role: UserRole } } };
        }) => {
          context.switchToHttp().getRequest().user = { id: 'user-1', role };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    role = UserRole.USER;
  });

  it('denies a regular user before invoking the admin service', async () => {
    await request(app.getHttpServer()).get('/api/admin/dashboard').expect(403);
    expect(admin.dashboard).not.toHaveBeenCalled();
    expect(operations.listOrders).not.toHaveBeenCalled();
  });

  it('allows an admin to load the dashboard', async () => {
    role = UserRole.ADMIN;
    await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ products: 4 }));
    expect(admin.dashboard).toHaveBeenCalledTimes(1);
  });

  it('protects operation endpoints with the same admin role guard', async () => {
    await request(app.getHttpServer()).get('/api/admin/orders').expect(403);
    expect(operations.listOrders).not.toHaveBeenCalled();

    role = UserRole.ADMIN;
    await request(app.getHttpServer()).get('/api/admin/orders').expect(200);
    expect(operations.listOrders).toHaveBeenCalledTimes(1);
  });
});
