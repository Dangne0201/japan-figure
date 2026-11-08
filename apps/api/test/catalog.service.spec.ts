import type Redis from 'ioredis';
import { Logger } from '@nestjs/common';
import { CatalogService } from '../src/catalog/catalog.service';
import type { PrismaService } from '../src/database/prisma.service';

describe('CatalogService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serves cached filter facets without querying PostgreSQL', async () => {
    const result = { brands: [], series: [], categories: [], scales: [] };
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
    };
    const service = new CatalogService(
      prisma as unknown as PrismaService,
      redis as unknown as Redis,
    );

    await expect(service.facets()).resolves.toEqual(result);
    expect(redis.get).toHaveBeenCalledWith('catalog:v1:facets');
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
    });
    expect(prisma.brand.findMany).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('catalog:v1:facets', expect.any(String), 'EX', 60);
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining('Catalog cache read failed; serving uncached data'),
    );
  });
});
