import catalog from '../prisma/seed-data/catalog.json';

describe('catalog seed data', () => {
  it('contains exactly 50 unique products across the configured catalog', () => {
    expect(catalog.products).toHaveLength(50);
    expect(new Set(catalog.products.map(({ slug }) => slug)).size).toBe(50);
    expect(catalog.categories).toHaveLength(4);
    expect(catalog.brands.length).toBeGreaterThan(0);
    expect(catalog.series.length).toBeGreaterThan(0);
  });

  it('uses valid references and integer VND demo prices', () => {
    for (const product of catalog.products) {
      expect(catalog.series.some(({ slug }) => slug === product.series)).toBe(true);
      expect(catalog.brands.some(({ slug }) => slug === product.brand)).toBe(true);
      expect(catalog.categories.some(({ slug }) => slug === product.category)).toBe(true);
      expect(Number.isSafeInteger(product.price)).toBe(true);
      expect(product.price).toBeGreaterThan(0);
      if (product.sale !== undefined) {
        expect(product.sale).toBeGreaterThan(0);
        expect(product.sale).toBeLessThan(product.price);
      }
      if (product.preorder) {
        expect(product.deposit).toBeGreaterThan(0);
        expect(product.deposit).toBeLessThanOrEqual(product.price);
      }
    }
  });
});
