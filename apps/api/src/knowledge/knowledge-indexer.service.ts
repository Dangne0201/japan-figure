import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeSourceType, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { chunkMarkdown, normalizeForSearch, type TextChunk } from './chunking';
import { EmbeddingClient } from './embedding-client';

const productInclude = {
  brand: { select: { name: true } },
  series: { select: { name: true } },
  variants: { select: { stockOnHand: true, stockReserved: true } },
} as const;

@Injectable()
export class KnowledgeIndexer {
  private readonly logger = new Logger(KnowledgeIndexer.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingClient,
  ) {}

  async reindexAll(knowledgeDirectory: string): Promise<{ documents: number; products: number }> {
    const files = (await readdir(knowledgeDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map(({ name }) => name)
      .sort();
    if (!files.length) {
      throw new Error(`No Markdown knowledge documents found in ${knowledgeDirectory}.`);
    }

    for (const filename of files) {
      const sourcePath = path.join(knowledgeDirectory, filename);
      const markdown = await readFile(sourcePath, 'utf8');
      const title = markdown.match(/^#\s+(.+)$/mu)?.[1]?.trim() ?? filename;
      await this.replaceSource({
        sourceType: KnowledgeSourceType.DOCUMENT,
        sourceId: filename,
        sourceTitle: title,
        sourcePath: `knowledge/${filename}`,
        productId: null,
        content: markdown,
        metadata: { filename },
      });
    }

    const indexedDocuments = new Set(files);
    await this.prisma.knowledgeChunk.deleteMany({
      where: {
        sourceType: KnowledgeSourceType.DOCUMENT,
        ...(indexedDocuments.size ? { sourceId: { notIn: [...indexedDocuments] } } : {}),
      },
    });

    const products = await this.prisma.product.findMany({
      where: { publishedAt: { not: null } },
      include: productInclude,
      orderBy: { id: 'asc' },
    });
    for (const product of products) {
      await this.indexProduct(product);
    }

    const publishedProductIds = products.map(({ id }) => id);
    await this.prisma.knowledgeChunk.deleteMany({
      where: {
        sourceType: KnowledgeSourceType.PRODUCT,
        ...(publishedProductIds.length ? { sourceId: { notIn: publishedProductIds } } : {}),
      },
    });
    this.logger.log(
      `Reindexed ${files.length} knowledge documents and ${products.length} published products.`,
    );
    return { documents: files.length, products: products.length };
  }

  async reindexProduct(productId: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: productInclude,
    });
    if (!product || !product.publishedAt) {
      await this.prisma.knowledgeChunk.deleteMany({
        where: { sourceType: KnowledgeSourceType.PRODUCT, sourceId: productId },
      });
      return;
    }
    await this.indexProduct(product);
  }

  private async indexProduct(
    loadedProduct: Prisma.ProductGetPayload<{ include: typeof productInclude }>,
  ): Promise<void> {
    const availableStock = loadedProduct.variants.reduce(
      (total, variant) => total + Math.max(variant.stockOnHand - variant.stockReserved, 0),
      0,
    );
    const text = [
      `Sản phẩm: ${loadedProduct.name}`,
      `Nhân vật: ${loadedProduct.characterName}`,
      `Series: ${loadedProduct.series.name}`,
      `Thương hiệu: ${loadedProduct.brand.name}`,
      `Mô tả: ${loadedProduct.description}`,
      `Giá niêm yết: ${formatVnd(loadedProduct.priceVnd)}`,
      ...(loadedProduct.salePriceVnd !== null
        ? [`Giá khuyến mãi: ${formatVnd(loadedProduct.salePriceVnd)}`]
        : []),
      `Trạng thái: ${loadedProduct.isPreorder ? 'đặt trước' : 'đang bán'}`,
      `Trạng thái tồn kho: ${availableStock > 0 ? 'còn hàng' : 'hết hàng'}`,
      `Tổng tồn kho khả dụng trong catalog: ${availableStock}`,
      ...(loadedProduct.releaseDate
        ? [
            `Ngày phát hành trong dữ liệu demo: ${loadedProduct.releaseDate.toISOString().slice(0, 10)}`,
          ]
        : []),
    ].join('\n');

    await this.replaceSource({
      sourceType: KnowledgeSourceType.PRODUCT,
      sourceId: loadedProduct.id,
      sourceTitle: loadedProduct.name,
      sourcePath: `/products/${loadedProduct.slug}`,
      productId: loadedProduct.id,
      content: text,
      metadata: {
        productId: loadedProduct.id,
        slug: loadedProduct.slug,
        name: loadedProduct.name,
        priceVnd: loadedProduct.salePriceVnd ?? loadedProduct.priceVnd,
        availableStock,
        isPreorder: loadedProduct.isPreorder,
        url: `/products/${loadedProduct.slug}`,
      },
    });
  }

  private async replaceSource(input: {
    sourceType: KnowledgeSourceType;
    sourceId: string;
    sourceTitle: string;
    sourcePath: string | null;
    productId: string | null;
    content: string;
    metadata: Record<string, string | number | boolean>;
  }): Promise<void> {
    const chunks = chunkMarkdown(input.content);
    const vectors = await this.embeddings.embed(chunks.map(({ content }) => content));
    if (vectors.length !== chunks.length) {
      throw new Error(`Embedding count mismatch for knowledge source ${input.sourceId}.`);
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`
          DELETE FROM "knowledge_chunks"
          WHERE "source_type" = ${input.sourceType}::"KnowledgeSourceType"
            AND "source_id" = ${input.sourceId}
        `;
        for (const [index, chunk] of chunks.entries()) {
          const vector = vectors[index];
          if (!vector) throw new Error(`Missing embedding ${index} for ${input.sourceId}.`);
          await insertChunk(transaction, input, chunk, vector);
        }
      },
      { timeout: 60_000 },
    );
  }
}

function formatVnd(amount: number): string {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError('Product VND prices must be non-negative safe integers.');
  }
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

async function insertChunk(
  transaction: Prisma.TransactionClient,
  source: {
    sourceType: KnowledgeSourceType;
    sourceId: string;
    sourceTitle: string;
    sourcePath: string | null;
    productId: string | null;
    metadata: Record<string, string | number | boolean>;
  },
  chunk: TextChunk,
  vector: number[],
): Promise<void> {
  const contentHash = createHash('sha256').update(chunk.content).digest('hex');
  const embedding = `[${vector.join(',')}]`;
  await transaction.$executeRaw`
    INSERT INTO "knowledge_chunks" (
      "id", "source_type", "source_id", "source_title", "source_path",
      "chunk_index", "content", "normalized_content", "content_hash", "metadata",
      "embedding", "product_id", "updated_at"
    )
    VALUES (
      ${randomUUID()}, ${source.sourceType}::"KnowledgeSourceType", ${source.sourceId},
      ${source.sourceTitle}, ${source.sourcePath}, ${chunk.index}, ${chunk.content},
      ${normalizeForSearch(chunk.content)}, ${contentHash}, ${JSON.stringify(source.metadata)}::jsonb,
      ${embedding}::vector, ${source.productId}, CURRENT_TIMESTAMP
    )
  `;
}
