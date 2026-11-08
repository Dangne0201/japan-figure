import type Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { CatalogService } from '../src/catalog/catalog.service';
import type { PrismaService } from '../src/database/prisma.service';

describe('CatalogService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves cached filter facets without querying PostgreSQL', async () => {
    const result = { brands: [], series: [], categories: [], scales: [], releaseYears: [] };
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(result)),
      set: jest.fn(),
      del: jest.fn(),
    };
    const prisma = {
      brand: { findMany: jest.fn() },
      series: { findMany: jest.fn() },
      category: { findMany: jest.fn() },
      product: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    const service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as Redis,
    );

    await expect(service.facets()).resolves.toEqual(result);
    expect(redis.get).toHaveBeenCalledWith('catalog:v3:facets');
    expect(prisma.brand.findMany).not.toHaveBeenCalled();
    expect(prisma.product.findMany).not.toHaveBeenCalled();
  });

  it('serves fresh results when Redis is unavailable and logs the cache failure', async () => {
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('Redis offline')),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn(),
    };
    const prisma = {
      brand: { findMany: jest.fn().mockResolvedValue([]) },
      series: { findMany: jest.fn().mockResolvedValue([]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as Redis,
    );
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(service.facets()).resolves.toEqual({
      brands: [],
      series: [],
      categories: [],
      scales: [],
      releaseYears: [],
    });
    expect(prisma.brand.findMany).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('catalog:v3:facets', expect.any(String), 'EX', 60);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Catalog cache read failed; serving uncached data'),
    );
  });

  it('counts only published products in each catalog facet', async () => {
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
    const prisma = {
      brand: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ slug: 'brand-a', name: 'Brand A', _count: { products: 3 } }]),
      },
      series: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ slug: 'series-a', name: 'Series A', _count: { products: 2 } }]),
      },
      category: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { slug: 'scale-figure', name: 'Scale Figure', _count: { products: 1 } },
          ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([{ scale: '1/7' }]) },
      $queryRaw: jest.fn().mockResolvedValue([{ year: 2026, productCount: 9 }]),
    };
    const service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as Redis,
    );

    await expect(service.facets()).resolves.toEqual({
      brands: [{ slug: 'brand-a', name: 'Brand A', productCount: 3 }],
      series: [{ slug: 'series-a', name: 'Series A', productCount: 2 }],
      categories: [{ slug: 'scale-figure', name: 'Scale Figure', productCount: 1 }],
      scales: ['1/7'],
      releaseYears: [{ year: 2026, productCount: 9 }],
    });
    expect(prisma.brand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: { products: { where: { publishedAt: { not: null } } } },
          },
        }),
      }),
    );
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          _count: {
            select: {
              products: { where: { product: { publishedAt: { not: null } } } },
            },
          },
        }),
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('adds approved review summaries to listed product cards', async () => {
    const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    const product = {
      id: 'product-1',
      slug: 'sample-figure',
      name: 'Sample Figure',
      characterName: 'Sample',
      description: 'Demo description',
      priceVnd: 100_000,
      salePriceVnd: null,
      scale: '1/7',
      material: 'PVC',
      releaseDate: null,
      janCode: 'DEMO-1',
      isPreorder: false,
      preorderDepositVnd: null,
      isFeatured: false,
      isNewArrival: false,
      brand: { slug: 'brand', name: 'Brand' },
      series: { slug: 'series', name: 'Series' },
      categories: [],
      variants: [
        {
          id: 'variant-1',
          sku: 'SKU-1',
          name: 'Standard',
          stockOnHand: 2,
          stockReserved: 0,
          weightGrams: 500,
        },
      ],
      images: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const prisma = {
      product: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([product]),
      },
      review: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { productId: 'product-1', _avg: { rating: 4.5 }, _count: { _all: 2 } },
          ]),
      },
    };
    const service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as Redis,
    );

    await expect(service.list({})).resolves.toMatchObject({
      items: [{ slug: 'sample-figure', averageRating: 4.5, reviewCount: 2 }],
    });
    expect(prisma.review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: { in: ['product-1'] }, status: 'APPROVED' },
      }),
    );
  });

  it('only serves banners within their active time window', async () => {
    const redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn(), del: jest.fn() };
    const prisma = {
      banner: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as Redis,
    );
    jest.spyOn(service, 'list').mockResolvedValue({ items: [], pagination: {} } as never);

    await expect(service.home()).resolves.toMatchObject({ banners: [] });
    const query = prisma.banner.findMany.mock.calls[0]?.[0];
    expect(query).toEqual(
      expect.objectContaining({
        where: {
          isActive: true,
          startsAt: { lte: expect.any(Date) },
          endsAt: { gt: expect.any(Date) },
        },
      }),
    );
    expect((query?.where.startsAt.lte as Date).getTime()).toBe(
      (query?.where.endsAt.gt as Date).getTime(),
    );
  });
});
