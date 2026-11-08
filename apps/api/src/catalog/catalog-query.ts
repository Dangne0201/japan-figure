import { Prisma } from '../generated/prisma/client';

export type Availability = 'in-stock' | 'sold-out';
export type CatalogSort = 'newest' | 'price-asc' | 'price-desc' | 'name-asc';

export interface CatalogFilters {
  brand?: string;
  series?: string;
  category?: string;
  scale?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: Availability;
  preorder?: boolean;
  featured?: boolean;
  newArrival?: boolean;
  saleOnly?: boolean;
}

export function buildCatalogWhere(
  filters: CatalogFilters,
  matchingIds?: string[],
  availableProductIds: string[] = [],
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { publishedAt: { not: null } };

  if (matchingIds) where.id = { in: matchingIds };
  if (filters.brand) where.brand = { slug: filters.brand };
  if (filters.series) where.series = { slug: filters.series };
  if (filters.category) where.categories = { some: { category: { slug: filters.category } } };
  if (filters.scale) where.scale = filters.scale;
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.priceVnd = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }
  if (filters.preorder !== undefined) where.isPreorder = filters.preorder;
  if (filters.featured !== undefined) where.isFeatured = filters.featured;
  if (filters.newArrival !== undefined) where.isNewArrival = filters.newArrival;
  if (filters.saleOnly) where.salePriceVnd = { not: null };
  if (filters.availability === 'in-stock') {
    where.OR = [{ isPreorder: true }, { id: { in: availableProductIds } }];
  } else if (filters.availability === 'sold-out') {
    where.isPreorder = false;
    where.id = {
      ...(matchingIds ? { in: matchingIds } : {}),
      notIn: availableProductIds,
    };
  }

  return where;
}

export function catalogOrderBy(sort: CatalogSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case 'price-asc':
      return [{ priceVnd: 'asc' }, { id: 'asc' }];
    case 'price-desc':
      return [{ priceVnd: 'desc' }, { id: 'asc' }];
    case 'name-asc':
      return [{ name: 'asc' }, { id: 'asc' }];
    default:
      return [{ createdAt: 'desc' }, { id: 'asc' }];
  }
}

export function normalizeSearchQuery(value: string | undefined): string | undefined {
  const query = value?.trim().replace(/\s+/gu, ' ');
  if (!query) return undefined;
  return query.slice(0, 100);
}
