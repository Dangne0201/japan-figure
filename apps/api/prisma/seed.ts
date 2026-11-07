import { PrismaClient } from '@prisma/client';
import catalog from './seed-data/catalog.json';

const prisma = new PrismaClient();

interface SeedProduct {
  slug: string;
  series: string;
  character: string;
  brand: string;
  category: string;
  price: number;
  sale?: number;
  scale: string | null;
  release: string;
  stock: number;
  preorder?: boolean;
  deposit?: number;
  featured?: boolean;
  newArrival?: boolean;
  style: string;
}

async function seed(): Promise<void> {
  for (const brand of catalog.brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      create: brand,
      update: { name: brand.name },
    });
  }

  for (const series of catalog.series) {
    await prisma.series.upsert({
      where: { slug: series.slug },
      create: series,
      update: { name: series.name },
    });
  }

  for (const category of catalog.categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: category,
      update: { name: category.name },
    });
  }

  const seriesBySlug = new Map(catalog.series.map((series) => [series.slug, series.name]));
  const today = new Date('2026-11-07T00:00:00.000Z');

  for (const [index, rawProduct] of catalog.products.entries()) {
    const product = rawProduct as SeedProduct;
    const seriesName = seriesBySlug.get(product.series);
    if (!seriesName) throw new Error(`Unknown series "${product.series}" in ${product.slug}`);

    const name = `${product.character} – ${seriesName}`;
    const description = `Mô hình ${product.character} tái hiện ${product.style}, lấy cảm hứng từ ${seriesName}. Sản phẩm thuộc dòng ${catalog.categories.find((category) => category.slug === product.category)?.name ?? product.category}, phù hợp để trưng bày trong bộ sưu tập figure anime.`;
    const preorder = product.preorder ?? false;
    const saved = await prisma.product.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        name,
        characterName: product.character,
        description,
        priceVnd: product.price,
        salePriceVnd: product.sale ?? null,
        scale: product.scale,
        material: 'PVC, ABS',
        releaseDate: new Date(`${product.release}T00:00:00.000Z`),
        janCode: `JF2026-${String(index + 1).padStart(5, '0')}`,
        isPreorder: preorder,
        preorderDepositVnd: product.deposit ?? null,
        isFeatured: product.featured ?? false,
        isNewArrival: product.newArrival ?? false,
        publishedAt: today,
        brand: { connect: { slug: product.brand } },
        series: { connect: { slug: product.series } },
        categories: { create: { category: { connect: { slug: product.category } } } },
      },
      update: {
        name,
        characterName: product.character,
        description,
        priceVnd: product.price,
        salePriceVnd: product.sale ?? null,
        scale: product.scale,
        material: 'PVC, ABS',
        releaseDate: new Date(`${product.release}T00:00:00.000Z`),
        isPreorder: preorder,
        preorderDepositVnd: product.deposit ?? null,
        isFeatured: product.featured ?? false,
        isNewArrival: product.newArrival ?? false,
        publishedAt: today,
        brand: { connect: { slug: product.brand } },
        series: { connect: { slug: product.series } },
        categories: {
          deleteMany: {},
          create: { category: { connect: { slug: product.category } } },
        },
      },
    });

    await prisma.productVariant.upsert({
      where: { sku: `JF-${product.slug.toUpperCase()}` },
      create: {
        productId: saved.id,
        sku: `JF-${product.slug.toUpperCase()}`,
        name: 'Phiên bản tiêu chuẩn',
        stockOnHand: product.stock,
      },
      update: { productId: saved.id, stockOnHand: product.stock },
    });

    await prisma.productImage.upsert({
      where: { productId_position: { productId: saved.id, position: 0 } },
      create: {
        productId: saved.id,
        url: `/products/${product.slug}.svg`,
        altText: `Hình minh họa ${name}`,
      },
      update: {
        url: `/products/${product.slug}.svg`,
        altText: `Hình minh họa ${name}`,
      },
    });
  }

  const count = await prisma.product.count({ where: { publishedAt: { not: null } } });
  console.log(
    `Seeded ${catalog.brands.length} brands, ${catalog.series.length} series, and ${count} published products.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error('Catalog seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
