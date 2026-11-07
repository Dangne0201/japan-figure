import { BadRequestException, ConflictException } from '@nestjs/common';
import { CheckoutService } from '../src/commerce/checkout.service';
import type { PrismaService } from '../src/database/prisma.service';

const address = {
  id: 'caddress123456789012345678',
  userId: 'user-1',
  recipientName: 'Người nhận',
  phone: '0912345678',
  streetAddress: 'Số 1 Nguyễn Trãi',
  provinceCode: '01',
  provinceName: 'Thành phố Hà Nội',
  communeCode: '00004',
  communeName: 'Phường Ba Đình',
  communeType: 'Phường',
};

const item = {
  id: 'cart-item-1',
  quantity: 1,
  unitPriceVnd: 100_000,
  variant: {
    id: 'variant-1',
    sku: 'JF-1',
    name: 'Bản tiêu chuẩn',
    stockOnHand: 5,
    stockReserved: 0,
    weightGrams: 1_000,
    product: {
      slug: 'figure-1',
      name: 'Figure 1',
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      priceVnd: 100_000,
      salePriceVnd: 90_000,
    },
  },
};

function createService(options?: {
  voucher?: Record<string, unknown> | null;
  totalUses?: number;
  userUses?: number;
  pointsBalance?: number;
  cartItem?: typeof item;
}) {
  const prisma = {
    address: { findFirst: jest.fn().mockResolvedValue(address) },
    cart: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cart-1', items: [options?.cartItem ?? item] }),
    },
    loyaltyAccount: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          options?.pointsBalance === undefined
            ? null
            : { id: 'loyalty-1', pointsBalance: options.pointsBalance },
        ),
    },
    voucher: { findUnique: jest.fn().mockResolvedValue(options?.voucher ?? null) },
    voucherRedemption: {
      count: jest
        .fn()
        .mockResolvedValueOnce(options?.totalUses ?? 0)
        .mockResolvedValueOnce(options?.userUses ?? 0),
    },
  };
  return {
    service: new CheckoutService(prisma as unknown as PrismaService, {
      enqueueProduct: jest.fn().mockResolvedValue(undefined),
    }),
    prisma,
  };
}

describe('CheckoutService', () => {
  it('uses the live sale price and returns region-based mock carrier quotes', async () => {
    const { service } = createService();
    const quote = await service.quote('user-1', {
      addressId: address.id,
      carrierId: 'mock-ghn',
    });

    expect(quote.amounts).toMatchObject({
      subtotalVnd: 90_000,
      voucherDiscountVnd: 0,
      shippingFeeVnd: 26_000,
      totalVnd: 116_000,
    });
    expect(quote.shippingOptions).toHaveLength(3);
    expect(quote.shippingOptions.every((option) => option.carrierName.includes('mô phỏng'))).toBe(
      true,
    );
  });

  it('enforces user voucher limits and permits point redemption only when stackable', async () => {
    const { service } = createService({
      pointsBalance: 1_000,
      voucher: {
        id: 'voucher-1',
        code: 'FIGURE10',
        type: 'PERCENT',
        value: 10,
        minSubtotalVnd: 50_000,
        maxDiscountVnd: 100_000,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        totalLimit: 10,
        perUserLimit: 1,
        isStackable: true,
      },
    });
    const quote = await service.quote('user-1', {
      addressId: address.id,
      carrierId: 'mock-ghn',
      voucherCode: 'figure10',
      redeemPoints: 100,
    });

    expect(quote.amounts).toMatchObject({
      subtotalVnd: 90_000,
      voucherDiscountVnd: 9_000,
      loyaltyDiscountVnd: 10_000,
      shippingFeeVnd: 26_000,
      totalVnd: 97_000,
      pointsEarned: 7,
    });
  });

  it('rejects a voucher after the current user has consumed their limit', async () => {
    const { service } = createService({
      userUses: 1,
      voucher: {
        id: 'voucher-1',
        code: 'ONCE',
        type: 'FIXED',
        value: 10_000,
        minSubtotalVnd: 0,
        maxDiscountVnd: null,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: new Date('2027-01-01T00:00:00.000Z'),
        totalLimit: null,
        perUserLimit: 1,
        isStackable: true,
      },
    });

    await expect(
      service.quote('user-1', {
        addressId: address.id,
        voucherCode: 'ONCE',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects checkout when stock has fallen below the cart quantity', async () => {
    const { service } = createService({
      cartItem: {
        ...item,
        quantity: 6,
        variant: { ...item.variant, stockOnHand: 5 },
      },
    });
    await expect(service.quote('user-1', { addressId: address.id })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('subtracts active reservations from stock available to checkout', async () => {
    const { service } = createService({
      cartItem: {
        ...item,
        quantity: 4,
        variant: { ...item.variant, stockReserved: 2 },
      },
    });
    await expect(service.quote('user-1', { addressId: address.id })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
