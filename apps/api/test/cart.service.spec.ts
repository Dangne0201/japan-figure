import { BadRequestException, ConflictException } from '@nestjs/common';
import Redis from 'ioredis';
import { CartService } from '../src/cart/cart.service';
import type { PrismaService } from '../src/database/prisma.service';

describe('CartService', () => {
  it('keeps unavailable guest-cart items visible for removal', async () => {
    const guestId = 'a'.repeat(43);
    const redis = {
      get: jest.fn().mockResolvedValue(
        JSON.stringify({
          items: [{ variantId: 'deleted-variant', quantity: 1, unitPriceVnd: 100_000 }],
        }),
      ),
      set: jest.fn(),
    };
    const prisma = {
      productVariant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new CartService(prisma as unknown as PrismaService, redis as unknown as Redis);

    await expect(service.getCart(undefined, guestId)).resolves.toMatchObject({
      itemCount: 1,
      items: [{ productName: 'Sản phẩm không còn trong danh mục', isAvailable: false }],
    });
    expect(redis.set).toHaveBeenCalled();
  });

  it('does not drop an unavailable item when merging a guest cart', async () => {
    const guestId = 'a'.repeat(43);
    const redis = {
      get: jest.fn().mockResolvedValue(
        JSON.stringify({
          items: [{ variantId: 'deleted-variant', quantity: 1, unitPriceVnd: 100_000 }],
        }),
      ),
      del: jest.fn(),
    };
    const transaction = {
      cartMergeReceipt: { findUnique: jest.fn().mockResolvedValue(null) },
      cart: { upsert: jest.fn().mockResolvedValue({ id: 'cart-1' }) },
      productVariant: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
      cartMergeReceipt: { findUnique: jest.fn() },
    };
    const service = new CartService(prisma as unknown as PrismaService, redis as unknown as Redis);

    await expect(service.mergeGuestCart('user-1', guestId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('rejects a guest cart quantity that exceeds authoritative stock', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
    };
    const prisma = {
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'variant-1',
          sku: 'JF-1',
          name: 'Standard',
          stockOnHand: 1,
          product: {
            publishedAt: new Date(),
            priceVnd: 100_000,
            salePriceVnd: null,
          },
        }),
      },
    };
    const service = new CartService(prisma as unknown as PrismaService, redis as unknown as Redis);

    await expect(service.addItem(undefined, 'a'.repeat(43), 'variant-1', 2)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('rejects a guest identifier that was not generated as an opaque token', async () => {
    const redis = { get: jest.fn(), set: jest.fn() };
    const prisma = {
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'variant-1',
          sku: 'JF-1',
          name: 'Standard',
          stockOnHand: 2,
          product: { publishedAt: new Date(), priceVnd: 100_000, salePriceVnd: null },
        }),
      },
    };
    const service = new CartService(prisma as unknown as PrismaService, redis as unknown as Redis);

    await expect(
      service.addItem(undefined, 'not-a-valid-id', 'variant-1', 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productVariant.findFirst).toHaveBeenCalled();
  });
});
