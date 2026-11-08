import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type Redis from 'ioredis';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  buildCatalogWhere,
  catalogOrderBy,
  CatalogFilters,
  CatalogSort,
  normalizeSearchQuery,
} from './catalog-query';

const productInclude = {
  brand: true,
  series: true,
  categories: { include: { category: true } },
  variants: {
    select: {
      id: true,
      stockOnHand: true,
      stockReserved: true,
      sku: true,
      name: true,
      weightGrams: true,
    },
  },
  images: { orderBy: { position: 'asc' as const } },
};

type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

interface CatalogListQuery {
  q?: string;
  brand?: string;
  series?: string;
  category?: string;
  scale?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: 'in-stock' | 'sold-out';
  preorder?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  saleOnly?: boolean;
  sort?: CatalogSort;
  page?: number;
  limit?: number;
}

export interface ProductCard {
  slug: string;
  name: string;
  characterName: string;
  description: string;
  priceVnd: number;
  salePriceVnd: number | null;
  scale: string | null;
  material: string;
  releaseDate: string | null;
  janCode: string;
  isPreorder: boolean;
  preorderDepositVnd: number | null;
  isFeatured: boolean;
  isNewArrival: boolean;
  stock: number;
  availability: 'in-stock' | 'sold-out';
  brand: { slug: string; name: string };
  series: { slug: string; name: string };
  categories: Array<{ slug: string; name: string }>;
  images: Array<{ url: string; altText: string }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    stockAvailable: number;
    weightGrams: number;
  }>;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);
  private hasLoggedCacheWarning = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async list(query: CatalogListQuery) {
    return this.listUncached(query);
  }

  private async listUncached(query: CatalogListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const search = normalizeSearchQuery(query.q);
    const filters: CatalogFilters = {
      ...(query.brand !== undefined ? { brand: query.brand } : {}),
      ...(query.series !== undefined ? { series: query.series } : {}),
      ...(query.category !== undefined ? { category: query.category } : {}),
      ...(query.scale !== undefined ? { scale: query.scale } : {}),
      ...(query.minPrice !== undefined ? { minPrice: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { maxPrice: query.maxPrice } : {}),
      ...(query.availability !== undefined ? { availability: query.availability } : {}),
      ...(query.preorder !== undefined ? { preorder: query.preorder } : {}),
      ...(query.featured !== undefined ? { featured: query.featured } : {}),
      ...(query.newArrival !== undefined ? { newArrival: query.newArrival } : {}),
      ...(query.saleOnly !== undefined ? { saleOnly: query.saleOnly } : {}),
    };
    const matching = search ? await this.findMatchingProductIds(search) : undefined;

    if (matching && matching.length === 0) {
      return { items: [], pagination: { page, limit, total: 0, pages: 0 } };
    }

    const availableProductIds =
      query.availability !== undefined ? await this.findAvailableProductIds() : [];
    const where = buildCatalogWhere(
      filters,
      matching?.map(({ id }) => id),
      availableProductIds,
    );
    if (search) {
      const candidates = await this.prisma.product.findMany({
        where,
        include: productInclude,
      });
      const relevance = new Map(matching?.map(({ id, score }) => [id, score]));
      candidates.sort((a, b) => {
        const byId = a.id.localeCompare(b.id);
        switch (query.sort) {
          case 'price-asc':
            return a.priceVnd - b.priceVnd || byId;
          case 'price-desc':
            return b.priceVnd - a.priceVnd || byId;
          case 'name-asc':
            return a.name.localeCompare(b.name) || byId;
          case 'newest':
            return b.createdAt.getTime() - a.createdAt.getTime() || byId;
          default:
            return (
              (relevance.get(b.id) ?? 0) - (relevance.get(a.id) ?? 0) ||
              a.name.localeCompare(b.name)
            );
        }
      });
      const total = candidates.length;
      const items = candidates.slice((page - 1) * limit, page * limit).map(toProductCard);
      return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: catalogOrderBy(query.sort ?? 'newest'),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: products.map(toProductCard),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async suggestions(value?: string) {
    const query = normalizeSearchQuery(value);
    if (!query || query.length < 2) return [];

    const matches = await this.findMatchingProductIds(query, 8);
    if (!matches.length) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: matches.map(({ id }) => id) }, publishedAt: { not: null } },
      select: { id: true, slug: true, name: true, characterName: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));
    return matches.flatMap(({ id }) => {
      const product = byId.get(id);
      return product
        ? [{ slug: product.slug, name: product.name, characterName: product.characterName }]
        : [];
    });
  }

  async facets() {
    return this.withCache('catalog:v2:facets', 60, async () => {
      const [brands, series, categories, scaleRows] = await Promise.all([
        this.prisma.brand.findMany({
          where: { products: { some: { publishedAt: { not: null } } } },
          select: {
            slug: true,
            name: true,
            _count: { select: { products: { where: { publishedAt: { not: null } } } } },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.series.findMany({
          where: { products: { some: { publishedAt: { not: null } } } },
          select: {
            slug: true,
            name: true,
            _count: { select: { products: { where: { publishedAt: { not: null } } } } },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.category.findMany({
          where: { products: { some: { product: { publishedAt: { not: null } } } } },
          select: {
            slug: true,
            name: true,
            _count: {
              select: {
                products: { where: { product: { publishedAt: { not: null } } } },
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.product.findMany({
          where: { publishedAt: { not: null }, scale: { not: null } },
          select: { scale: true },
          distinct: ['scale'],
          orderBy: { scale: 'asc' },
        }),
      ]);
      return {
        brands: brands.map(({ slug, name, _count }) => ({
          slug,
          name,
          productCount: _count.products,
        })),
        series: series.map(({ slug, name, _count }) => ({
          slug,
          name,
          productCount: _count.products,
        })),
        categories: categories.map(({ slug, name, _count }) => ({
          slug,
          name,
          productCount: _count.products,
        })),
        scales: scaleRows.flatMap(({ scale }) => scale ?? []),
      };
    });
  }

  async home() {
    return this.withCache('catalog:v1:home', 10, async () => {
      const now = new Date();
      const [featured, newArrivals, preorders, sales, banners] = await Promise.all([
        this.list({ featured: true, limit: 8 }),
        this.list({ newArrival: true, limit: 8 }),
        this.list({ preorder: true, limit: 8 }),
        this.list({ saleOnly: true, limit: 8, sort: 'price-asc' }),
        this.prisma.banner.findMany({
          where: { isActive: true, startsAt: { lte: now }, endsAt: { gt: now } },
          select: { id: true, title: true, description: true, imageUrl: true, href: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          take: 4,
        }),
      ]);
      return {
        featured: featured.items,
        newArrivals: newArrivals.items,
        preorders: preorders.items,
        sales: sales.items,
        banners,
      };
    });
  }

  async detail(slug: string) {
    return this.withCache(this.cacheKey('detail', slug), 10, async () => {
      const product = await this.prisma.product.findFirst({
        where: { slug, publishedAt: { not: null } },
        include: productInclude,
      });
      if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');

      const [related, reviews, reviewAggregate] = await Promise.all([
        this.prisma.product.findMany({
          where: {
            publishedAt: { not: null },
            seriesId: product.seriesId,
            id: { not: product.id },
          },
          include: productInclude,
          orderBy: [{ isFeatured: 'desc' }, { name: 'asc' }],
          take: 4,
        }),
        this.prisma.review.findMany({
          where: { productId: product.id, status: 'APPROVED' },
          select: {
            rating: true,
            body: true,
            createdAt: true,
            user: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.prisma.review.aggregate({
          where: { productId: product.id, status: 'APPROVED' },
          _avg: { rating: true },
        }),
      ]);
      return {
        product: toProductCard(product),
        related: related.map(toProductCard),
        reviews,
        averageRating: reviewAggregate._avg.rating,
      };
    });
  }

  private cacheKey(operation: string, value: unknown): string {
    const digest = createHash('sha256')
      .update(JSON.stringify(value) ?? 'null')
      .digest('hex');
    return `catalog:v1:${operation}:${digest}`;
  }

  private async withCache<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached !== null) {
        this.hasLoggedCacheWarning = false;
        try {
          return JSON.parse(cached) as T;
        } catch (error) {
          this.logCacheWarning('decode', error);
          await this.redis.del(key);
        }
      }
    } catch (error) {
      this.logCacheWarning('read', error);
    }

    const value = await load();
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      this.hasLoggedCacheWarning = false;
    } catch (error) {
      this.logCacheWarning('write', error);
    }
    return value;
  }

  private logCacheWarning(operation: string, error: unknown): void {
    if (this.hasLoggedCacheWarning) return;
    const detail = error instanceof Error ? error.message : 'Unknown Redis error';
    this.logger.warn(`Catalog cache ${operation} failed; serving uncached data. ${detail}`);
    this.hasLoggedCacheWarning = true;
  }

  private async findAvailableProductIds(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ productId: string }>>(Prisma.sql`
      SELECT DISTINCT product_id AS "productId"
      FROM product_variants
      WHERE stock_on_hand > stock_reserved
    `);
    return rows.map(({ productId }) => productId);
  }

  private async findMatchingProductIds(query: string, take?: number) {
    const pattern = `%${query}%`;
    return this.prisma.$queryRaw<Array<{ id: string; score: number }>>(Prisma.sql`
      SELECT p.id,
        GREATEST(
          similarity(immutable_unaccent(lower(p.name)), immutable_unaccent(lower(${query}))),
          similarity(immutable_unaccent(lower(p.character_name)), immutable_unaccent(lower(${query}))),
          similarity(immutable_unaccent(lower(s.name)), immutable_unaccent(lower(${query})))
        ) AS score
      FROM products p
      JOIN series s ON s.id = p.series_id
      WHERE p.published_at IS NOT NULL
        AND (
          immutable_unaccent(lower(p.name)) % immutable_unaccent(lower(${query}))
          OR immutable_unaccent(lower(p.character_name)) % immutable_unaccent(lower(${query}))
          OR immutable_unaccent(lower(s.name)) % immutable_unaccent(lower(${query}))
          OR immutable_unaccent(lower(p.name)) LIKE immutable_unaccent(lower(${pattern}))
          OR immutable_unaccent(lower(p.character_name)) LIKE immutable_unaccent(lower(${pattern}))
          OR immutable_unaccent(lower(s.name)) LIKE immutable_unaccent(lower(${pattern}))
        )
      ORDER BY score DESC, p.name ASC
      ${take ? Prisma.sql`LIMIT ${take}` : Prisma.empty}
    `);
  }
}

function toProductCard(product: CatalogProduct): ProductCard {
  const variants = product.variants.map(({ stockOnHand, stockReserved, ...variant }) => ({
    ...variant,
    stockAvailable: stockOnHand - stockReserved,
  }));
  const stock = variants.reduce((total, variant) => total + variant.stockAvailable, 0);
  return {
    slug: product.slug,
    name: product.name,
    characterName: product.characterName,
    description: product.description,
    priceVnd: product.priceVnd,
    salePriceVnd: product.salePriceVnd,
    scale: product.scale,
    material: product.material,
    releaseDate: product.releaseDate?.toISOString().slice(0, 10) ?? null,
    janCode: product.janCode,
    isPreorder: product.isPreorder,
    preorderDepositVnd: product.preorderDepositVnd,
    isFeatured: product.isFeatured,
    isNewArrival: product.isNewArrival,
    stock,
    availability: product.isPreorder || stock > 0 ? 'in-stock' : 'sold-out',
    brand: product.brand,
    series: product.series,
    categories: product.categories.map(({ category }) => category),
    images: product.images.map(({ url, altText }) => ({ url, altText })),
    variants,
  };
}
