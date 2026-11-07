import { BadRequestException, ConflictException } from '@nestjs/common';
import { AdminService } from '../src/admin/admin.service';
import type { UploadedWebpFile } from '../src/admin/admin.service';
import { loadConfig } from '../src/config/env';
import type { PrismaService } from '../src/database/prisma.service';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
  PRODUCT_UPLOAD_DIR: '/tmp/japan-figure-test-uploads',
});

function createService() {
  const transaction = {
    productVariant: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'variant-1',
        stockOnHand: 8,
        stockReserved: 4,
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'variant-1',
        sku: 'JF-1',
        name: 'Standard',
        stockOnHand: 10,
        stockReserved: 4,
        weightGrams: 1000,
      }),
    },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  return {
    service: new AdminService(prisma as unknown as PrismaService, config),
    transaction,
  };
}

describe('AdminService', () => {
  it('does not set stock below active reservations', async () => {
    const { service, transaction } = createService();

    await expect(
      service.setVariantStock('admin-1', 'product-1', 'variant-1', { stockOnHand: 3 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.productVariant.updateMany).not.toHaveBeenCalled();
    expect(transaction.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('updates stock conditionally and records the change', async () => {
    const { service, transaction } = createService();

    const variant = await service.setVariantStock('admin-1', 'product-1', 'variant-1', {
      stockOnHand: 10,
    });

    expect(variant.stockOnHand).toBe(10);
    expect(transaction.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'variant-1', stockReserved: { lte: 10 } },
      data: { stockOnHand: 10 },
    });
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'PRODUCT_STOCK_UPDATED',
          entityId: 'variant-1',
          details: { previousStockOnHand: 8, stockOnHand: 10, stockReserved: 4 },
        }),
      }),
    );
  });

  it('rejects a WebP upload whose bytes do not contain a WebP signature', async () => {
    const { service } = createService();

    await expect(
      service.uploadProductImage('admin-1', 'product-1', {
        buffer: Buffer.from('not an image'),
        size: 12,
        mimetype: 'image/webp',
      } satisfies UploadedWebpFile),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
