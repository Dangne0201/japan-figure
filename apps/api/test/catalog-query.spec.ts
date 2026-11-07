import {
  buildCatalogWhere,
  catalogOrderBy,
  normalizeSearchQuery,
} from '../src/catalog/catalog-query';

describe('catalog query helpers', () => {
  it('normalizes whitespace and bounds user search input', () => {
    expect(normalizeSearchQuery('  nhân   vật  ')).toBe('nhân vật');
    expect(normalizeSearchQuery('   ')).toBeUndefined();
    expect(normalizeSearchQuery('a'.repeat(120))).toHaveLength(100);
  });

  it('builds combined filter constraints without losing price boundaries', () => {
    expect(
      buildCatalogWhere({
        brand: 'good-smile-company',
        series: 'frieren-beyond-journeys-end',
        category: 'scale-figure',
        scale: '1/7',
        minPrice: 1_000_000,
        maxPrice: 4_000_000,
        preorder: true,
        featured: true,
        saleOnly: true,
      }),
    ).toEqual({
      publishedAt: { not: null },
      brand: { slug: 'good-smile-company' },
      series: { slug: 'frieren-beyond-journeys-end' },
      categories: { some: { category: { slug: 'scale-figure' } } },
      scale: '1/7',
      priceVnd: { gte: 1_000_000, lte: 4_000_000 },
      isPreorder: true,
      isFeatured: true,
      salePriceVnd: { not: null },
    });
  });

  it('includes preorders as available and excludes them from sold-out products', () => {
    expect(
      buildCatalogWhere({ availability: 'in-stock' }, undefined, ['available-product']),
    ).toMatchObject({
      OR: [{ isPreorder: true }, { id: { in: ['available-product'] } }],
    });
    expect(
      buildCatalogWhere({ availability: 'sold-out' }, undefined, ['available-product']),
    ).toMatchObject({
      isPreorder: false,
      id: { notIn: ['available-product'] },
    });
  });

  it('uses deterministic sort orders', () => {
    expect(catalogOrderBy('price-asc')).toEqual([{ priceVnd: 'asc' }, { id: 'asc' }]);
    expect(catalogOrderBy('newest')).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });
});
