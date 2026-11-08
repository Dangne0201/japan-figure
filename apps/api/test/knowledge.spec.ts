import { KnowledgeSourceType } from '../src/generated/prisma/client';
import { loadConfig } from '../src/config/env';
import type { PrismaService } from '../src/database/prisma.service';
import { chunkMarkdown, normalizeForSearch } from '../src/knowledge/chunking';
import { EmbeddingClient } from '../src/knowledge/embedding-client';
import {
  KnowledgeRetrievalService,
  rankKnowledgeCandidates,
  scoreHybridCandidate,
  type RawKnowledgeCandidate,
} from '../src/knowledge/knowledge-retrieval.service';

describe('knowledge chunking', () => {
  it('normalizes Vietnamese diacritics and spacing for trigram search', () => {
    expect(normalizeForSearch('  Phí giao hàng   mô phỏng ')).toBe('phi giao hang mo phong');
    expect(normalizeForSearch('ĐẶT trước')).toBe('dat truoc');
    expect(normalizeForSearch('Làm thế nào để bảo quản figure khỏi bụi?')).toBe(
      'lam the nao de bao quan figure khoi bui',
    );
  });

  it('preserves paragraph boundaries and returns bounded, indexed chunks', () => {
    const content = `${'A'.repeat(65)}\n\n${'B'.repeat(65)}\n\n${'C'.repeat(65)}`;
    const chunks = chunkMarkdown(content, 120, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map(({ index }) => index)).toEqual(chunks.map((_, index) => index));
    expect(chunks.every(({ content: text }) => text.length <= 120)).toBe(true);
    expect(chunks[0]?.content).toContain('A'.repeat(65));
    expect(chunks.at(-1)?.content).toContain('C'.repeat(65));
  });

  it('splits a long paragraph without dropping characters', () => {
    const input = `${'đ'.repeat(320)}.`;
    const chunks = chunkMarkdown(input, 120, 20);
    expect(chunks.every(({ content }) => content.length <= 120)).toBe(true);
    const combined = chunks.map(({ content }) => content).join('');
    expect(combined.replace(/[^đ.]/gu, '')).toContain('đ'.repeat(320));
    expect(combined.length).toBeGreaterThan(input.length);
    expect(chunks.at(-1)?.content).toContain('.');
  });

  it('rejects invalid chunk settings', () => {
    expect(() => chunkMarkdown('Nội dung', 99)).toThrow(RangeError);
    expect(() => chunkMarkdown('Nội dung', 100, 100)).toThrow(RangeError);
  });
});

describe('hybrid knowledge retrieval ranking', () => {
  const fixture: RawKnowledgeCandidate[] = [
    {
      id: 'chunk-a',
      source_type: KnowledgeSourceType.DOCUMENT,
      source_id: 'shipping.md',
      source_title: 'Phí giao hàng mô phỏng',
      source_path: 'knowledge/shipping.md',
      chunk_index: 0,
      content: 'Miễn phí giao hàng từ 1.500.000 ₫.',
      metadata: { filename: 'shipping.md' },
      vector_score: 0.8,
      keyword_score: 0.5,
    },
    {
      id: 'chunk-b',
      source_type: KnowledgeSourceType.PRODUCT,
      source_id: 'product-1',
      source_title: 'Figure demo',
      source_path: '/products/figure-demo',
      chunk_index: 1,
      content: 'Tồn kho khả dụng: 4.',
      metadata: { productId: 'product-1', availableStock: 4 },
      vector_score: 0.7,
      keyword_score: 0.2,
    },
    {
      id: 'chunk-c',
      source_type: KnowledgeSourceType.DOCUMENT,
      source_id: 'faq.md',
      source_title: 'Câu hỏi thường gặp',
      source_path: 'knowledge/faq.md',
      chunk_index: 0,
      content: 'Không có dữ liệu liên quan.',
      metadata: {},
      vector_score: 0.1,
      keyword_score: 0.1,
    },
  ];

  it('combines vector and keyword relevance and filters by threshold/top-k', () => {
    const results = rankKnowledgeCandidates(fixture, 0.4, 1);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      content: fixture[0]?.content,
      source: {
        type: 'document',
        id: 'shipping.md',
        path: 'knowledge/shipping.md',
        chunkIndex: 0,
      },
      metadata: { filename: 'shipping.md' },
    });
  });

  it('keeps low-score results out and clamps invalid scores safely', () => {
    expect(scoreHybridCandidate(Number.NaN, 0.4)).toBeCloseTo(0.112);
    expect(rankKnowledgeCandidates(fixture.slice(2), 0.4, 5)).toEqual([]);
  });

  it('embeds a bounded query and returns ranked source metadata from hybrid retrieval', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue(fixture) };
    const embeddings = { embed: jest.fn().mockResolvedValue([[...Array(1024).fill(0.01)]]) };
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
      KNOWLEDGE_RELEVANCE_THRESHOLD: '0.4',
      KNOWLEDGE_TOP_K: '2',
    });
    const service = new KnowledgeRetrievalService(
      prisma as unknown as PrismaService,
      embeddings as unknown as EmbeddingClient,
      config,
    );

    const results = await service.search('phí giao hàng');

    expect(embeddings.embed).toHaveBeenCalledWith(['phí giao hàng']);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results[0]?.source.id).toBe('shipping.md');
  });

  it('rejects invalid retrieval queries before requesting embeddings', async () => {
    const embeddings = { embed: jest.fn() };
    const service = new KnowledgeRetrievalService(
      {} as PrismaService,
      embeddings as unknown as EmbeddingClient,
      loadConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
      }),
    );

    await expect(service.search('  ')).rejects.toThrow('1 to 500 characters');
    await expect(service.search('\u0301')).rejects.toThrow('searchable characters');
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
});
