import { KnowledgeSourceType } from '../src/generated/prisma/client';
import { KnowledgeIndexer } from '../src/knowledge/knowledge-indexer.service';
import type { EmbeddingClient } from '../src/knowledge/embedding-client';
import type { PrismaService } from '../src/database/prisma.service';

describe('KnowledgeIndexer', () => {
  it('indexes only published products with current VND price and available stock', async () => {
    const product = {
      id: 'product-1',
      slug: 'figure-demo',
      name: 'Figure Demo',
      characterName: 'Nhân vật demo',
      description: 'Mô tả demo',
      priceVnd: 1_250_000,
      salePriceVnd: 1_100_000,
      isPreorder: false,
      releaseDate: new Date('2026-10-01T00:00:00.000Z'),
      publishedAt: new Date('2026-01-01T00:00:00.000Z'),
      brand: { name: 'Hãng demo' },
      series: { name: 'Series demo' },
      variants: [{ stockOnHand: 8, stockReserved: 3 }],
    };
    const transaction = { $executeRaw: jest.fn().mockResolvedValue(1) };
    const prisma = {
      product: { findUnique: jest.fn().mockResolvedValue(product) },
      knowledgeChunk: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<void>) =>
        callback(transaction),
      ),
    };
    const embeddings = {
      embed: jest.fn().mockResolvedValue([Array.from({ length: 1024 }, () => 0.01)]),
    };
    const indexer = new KnowledgeIndexer(
      prisma as unknown as PrismaService,
      embeddings as unknown as EmbeddingClient,
    );

    await indexer.reindexProduct('product-1');

    const indexedContent = embeddings.embed.mock.calls[0]?.[0]?.[0] ?? '';
    expect(indexedContent).toContain('1.100.000 ₫');
    expect(indexedContent).toContain('Tổng tồn kho khả dụng trong catalog: 5');
    expect(indexedContent).toContain('Series demo');
    expect(transaction.$executeRaw).toHaveBeenCalledTimes(2);
    expect(prisma.knowledgeChunk.deleteMany).not.toHaveBeenCalled();
  });

  it('removes chunks instead of indexing an unpublished product', async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          publishedAt: null,
        }),
      },
      knowledgeChunk: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const embeddings = { embed: jest.fn() };
    const indexer = new KnowledgeIndexer(
      prisma as unknown as PrismaService,
      embeddings as unknown as EmbeddingClient,
    );

    await indexer.reindexProduct('product-1');

    expect(prisma.knowledgeChunk.deleteMany).toHaveBeenCalledWith({
      where: { sourceType: KnowledgeSourceType.PRODUCT, sourceId: 'product-1' },
    });
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
});
