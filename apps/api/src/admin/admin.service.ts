import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ReviewStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeQueue, type ProductKnowledgeQueue } from '../knowledge/knowledge-queue.service';
import type { AppConfig } from '../config/env';
import type {
  AdminProductListDto,
  CreateAdminProductDto,
  SetProductStockDto,
  UpdateAdminProductDto,
} from './admin.dto';

const adminProductInclude = {
  brand: { select: { id: true, slug: true, name: true } },
  series: { select: { id: true, slug: true, name: true } },
  categories: { include: { category: { select: { id: true, slug: true, name: true } } } },
  variants: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      sku: true,
      name: true,
      stockOnHand: true,
      stockReserved: true,
      weightGrams: true,
    },
  },
  images: { orderBy: { position: 'asc' as const } },
} satisfies Prisma.ProductInclude;

const maxImageBytes = 5 * 1024 * 1024;
export interface UploadedWebpFile {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

const adminProductFields = [
  'slug',
  'name',
  'characterName',
  'description',
  'priceVnd',
  'salePriceVnd',
  'scale',
  'material',
  'releaseDate',
  'janCode',
  'isPreorder',
  'preorderDepositVnd',
  'isFeatured',
  'isNewArrival',
  'published',
  'brandId',
  'seriesId',
  'categoryIds',
] as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    @Inject(KnowledgeQueue) private readonly knowledgeQueue: ProductKnowledgeQueue,
  ) {}

  async dashboard() {
    const [products, publishedProducts, orders, activeOrders, customers, pendingReviews] =
      await Promise.all([
        this.prisma.product.count(),
        this.prisma.product.count({ where: { publishedAt: { not: null } } }),
        this.prisma.order.count(),
        this.prisma.order.count({
          where: {
            status: {
              in: [
                OrderStatus.PENDING_PAYMENT,
                OrderStatus.PAID,
                OrderStatus.PROCESSING,
                OrderStatus.SHIPPED,
              ],
            },
          },
        }),
        this.prisma.user.count({ where: { role: 'USER', disabledAt: null } }),
        this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      ]);
    return { products, publishedProducts, orders, activeOrders, customers, pendingReviews };
  }

  async productOptions() {
    const [brands, series, categories] = await Promise.all([
      this.prisma.brand.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.series.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.findMany({
        select: { id: true, slug: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { brands, series, categories };
  }

  async listProducts(query: AdminProductListDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const search = query.q?.trim();
    const where: Prisma.ProductWhereInput = search
      ? {
          OR: [
            { slug: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { characterName: { contains: search, mode: 'insensitive' } },
            { janCode: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, items] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: adminProductInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return { items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async createProduct(actorUserId: string, input: CreateAdminProductDto) {
    this.validateProductPrices(input.priceVnd, input.salePriceVnd, input.preorderDepositVnd);
    await this.assertCatalogRelations(input.brandId, input.seriesId, input.categoryIds);
    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: {
            slug: input.slug,
            name: input.name,
            characterName: input.characterName,
            description: input.description,
            priceVnd: input.priceVnd,
            salePriceVnd: input.salePriceVnd ?? null,
            scale: input.scale ?? null,
            material: input.material,
            releaseDate: input.releaseDate
              ? new Date(`${input.releaseDate.slice(0, 10)}T00:00:00.000Z`)
              : null,
            janCode: input.janCode,
            isPreorder: input.isPreorder,
            preorderDepositVnd: input.preorderDepositVnd ?? null,
            isFeatured: input.isFeatured,
            isNewArrival: input.isNewArrival,
            publishedAt: input.published ? new Date() : null,
            brand: { connect: { id: input.brandId } },
            series: { connect: { id: input.seriesId } },
            categories: {
              create: input.categoryIds.map((id) => ({ category: { connect: { id } } })),
            },
            variants: {
              create: {
                sku: input.sku,
                name: input.variantName,
                weightGrams: input.weightGrams,
                stockOnHand: input.stockOnHand,
              },
            },
            images: {
              create: {
                url: `/catalog-assets/${input.slug}`,
                altText: `Hình minh họa ${input.name}`,
                position: 0,
              },
            },
          },
          include: adminProductInclude,
        });
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'PRODUCT_CREATED',
            entityType: 'product',
            entityId: product.id,
            details: { fields: [...adminProductFields, 'sku', 'stockOnHand'] },
          },
        });
        return product;
      });
      await this.knowledgeQueue.enqueueProduct(product.id);
      return product;
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async updateProduct(actorUserId: string, productId: string, input: UpdateAdminProductDto) {
    if (!Object.keys(input).length) throw new BadRequestException('Hãy nhập ít nhất một thay đổi.');
    const nullableFields = new Set(['salePriceVnd', 'scale', 'releaseDate', 'preorderDepositVnd']);
    if (
      Object.entries(input).some(([field, value]) => value === null && !nullableFields.has(field))
    ) {
      throw new BadRequestException('Một hoặc nhiều trường bắt buộc không thể để trống.');
    }
    const current = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        slug: true,
        publishedAt: true,
        priceVnd: true,
        salePriceVnd: true,
        preorderDepositVnd: true,
        brandId: true,
        seriesId: true,
        categories: { select: { categoryId: true } },
      },
    });
    if (!current) throw new NotFoundException('Không tìm thấy sản phẩm.');
    if (input.slug !== undefined && input.slug !== current.slug) {
      throw new BadRequestException('Slug không thể đổi sau khi tạo để giữ ổn định liên kết ảnh.');
    }
    this.validateProductPrices(
      input.priceVnd ?? current.priceVnd,
      input.salePriceVnd === undefined ? current.salePriceVnd : input.salePriceVnd,
      input.preorderDepositVnd === undefined
        ? current.preorderDepositVnd
        : input.preorderDepositVnd,
    );
    if (input.brandId || input.seriesId || input.categoryIds) {
      await this.assertCatalogRelations(
        input.brandId ?? current.brandId,
        input.seriesId ?? current.seriesId,
        input.categoryIds ?? current.categories.map(({ categoryId }) => categoryId),
      );
    }

    const data: Prisma.ProductUpdateInput = {
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.characterName !== undefined ? { characterName: input.characterName } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.priceVnd !== undefined ? { priceVnd: input.priceVnd } : {}),
      ...(input.salePriceVnd !== undefined ? { salePriceVnd: input.salePriceVnd } : {}),
      ...(input.scale !== undefined ? { scale: input.scale } : {}),
      ...(input.material !== undefined ? { material: input.material } : {}),
      ...(input.releaseDate !== undefined
        ? {
            releaseDate: input.releaseDate
              ? new Date(`${input.releaseDate.slice(0, 10)}T00:00:00.000Z`)
              : null,
          }
        : {}),
      ...(input.janCode !== undefined ? { janCode: input.janCode } : {}),
      ...(input.isPreorder !== undefined ? { isPreorder: input.isPreorder } : {}),
      ...(input.preorderDepositVnd !== undefined
        ? { preorderDepositVnd: input.preorderDepositVnd }
        : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.isNewArrival !== undefined ? { isNewArrival: input.isNewArrival } : {}),
      ...(input.published !== undefined
        ? { publishedAt: input.published ? (current.publishedAt ?? new Date()) : null }
        : {}),
      ...(input.brandId !== undefined ? { brand: { connect: { id: input.brandId } } } : {}),
      ...(input.seriesId !== undefined ? { series: { connect: { id: input.seriesId } } } : {}),
      ...(input.categoryIds !== undefined
        ? {
            categories: {
              deleteMany: {},
              create: input.categoryIds.map((id) => ({ category: { connect: { id } } })),
            },
          }
        : {}),
    };

    try {
      const product = await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.update({
          where: { id: productId },
          data,
          include: adminProductInclude,
        });
        if (input.name !== undefined) {
          await transaction.productImage.updateMany({
            where: { productId: product.id, position: 0 },
            data: { altText: `Hình minh họa ${product.name}` },
          });
        }
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'PRODUCT_UPDATED',
            entityType: 'product',
            entityId: product.id,
            details: { fields: Object.keys(input) },
          },
        });
        return product;
      });
      await this.knowledgeQueue.enqueueProduct(product.id);
      return product;
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async setVariantStock(
    actorUserId: string,
    productId: string,
    variantId: string,
    input: SetProductStockDto,
  ) {
    try {
      const variant = await this.prisma.$transaction(async (transaction) => {
        const variant = await transaction.productVariant.findFirst({
          where: { id: variantId, productId },
          select: { id: true, stockOnHand: true, stockReserved: true },
        });
        if (!variant) throw new NotFoundException('Không tìm thấy phiên bản sản phẩm.');
        if (input.stockOnHand < variant.stockReserved) {
          throw new ConflictException(
            `Tồn kho không thể thấp hơn ${variant.stockReserved} sản phẩm đang được giữ.`,
          );
        }
        const updated = await transaction.productVariant.updateMany({
          where: { id: variant.id, stockReserved: { lte: input.stockOnHand } },
          data: { stockOnHand: input.stockOnHand },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Tồn kho vừa thay đổi. Hãy tải lại và thử lại.');
        }
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'PRODUCT_STOCK_UPDATED',
            entityType: 'product_variant',
            entityId: variant.id,
            details: {
              previousStockOnHand: variant.stockOnHand,
              stockOnHand: input.stockOnHand,
              stockReserved: variant.stockReserved,
            },
          },
        });
        return transaction.productVariant.findUniqueOrThrow({
          where: { id: variant.id },
          select: {
            id: true,
            sku: true,
            name: true,
            stockOnHand: true,
            stockReserved: true,
            weightGrams: true,
          },
        });
      });
      await this.knowledgeQueue.enqueueProduct(productId);
      return variant;
    } catch (error) {
      this.handleProductWriteError(error);
    }
  }

  async uploadProductImage(actorUserId: string, productId: string, file: UploadedWebpFile) {
    if (
      file?.mimetype !== 'image/webp' ||
      !file.buffer.length ||
      file.size !== file.buffer.length ||
      file.size > maxImageBytes ||
      !isWebp(file.buffer)
    ) {
      throw new BadRequestException('Ảnh phải là tệp WebP hợp lệ, dung lượng tối đa 5 MiB.');
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, slug: true, name: true },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm.');

    const directory = path.resolve(this.config.PRODUCT_UPLOAD_DIR);
    const destination = path.join(directory, `${product.slug}.webp`);
    const temporary = path.join(directory, `.${product.slug}-${randomUUID()}.tmp`);
    await mkdir(directory, { recursive: true });
    const previousImage = await readOptionalFile(destination);
    await writeFile(temporary, file.buffer, { flag: 'wx' });
    let replacedImage = false;
    try {
      await rename(temporary, destination);
      replacedImage = true;
      await this.prisma.$transaction(async (transaction) => {
        await transaction.productImage.upsert({
          where: { productId_position: { productId: product.id, position: 0 } },
          create: {
            productId: product.id,
            url: `/catalog-assets/${product.slug}`,
            altText: `Hình minh họa ${product.name}`,
            position: 0,
          },
          update: {
            url: `/catalog-assets/${product.slug}`,
            altText: `Hình minh họa ${product.name}`,
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actorUserId,
            action: 'PRODUCT_IMAGE_UPLOADED',
            entityType: 'product',
            entityId: product.id,
            details: { contentType: 'image/webp', byteSize: file.size },
          },
        });
      });
    } catch (error) {
      if (replacedImage) {
        if (previousImage) await writeFile(destination, previousImage);
        else await removeFileIfPresent(destination);
      }
      this.handleProductWriteError(error);
    } finally {
      await removeFileIfPresent(temporary);
    }
    return { url: `/catalog-assets/${product.slug}` };
  }

  private validateProductPrices(
    priceVnd: number,
    salePriceVnd: number | null | undefined,
    preorderDepositVnd: number | null | undefined,
  ): void {
    if (salePriceVnd != null && salePriceVnd >= priceVnd) {
      throw new BadRequestException('Giá ưu đãi phải thấp hơn giá niêm yết.');
    }
    if (preorderDepositVnd != null && preorderDepositVnd > priceVnd) {
      throw new BadRequestException('Tiền cọc không thể cao hơn giá niêm yết.');
    }
  }

  private async assertCatalogRelations(
    brandId: string,
    seriesId: string,
    categoryIds: string[],
  ): Promise<void> {
    const [brand, series, categories] = await Promise.all([
      this.prisma.brand.findUnique({ where: { id: brandId }, select: { id: true } }),
      this.prisma.series.findUnique({ where: { id: seriesId }, select: { id: true } }),
      this.prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      }),
    ]);
    if (!brand || !series || categories.length !== categoryIds.length) {
      throw new BadRequestException('Hãng, bộ truyện hoặc thể loại đã chọn không tồn tại.');
    }
  }

  private handleProductWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException('Slug, mã JAN hoặc SKU đã được sử dụng.');
      }
      if (error.code === 'P2003' || error.code === 'P2025') {
        throw new BadRequestException('Dữ liệu danh mục hoặc phiên bản không còn hợp lệ.');
      }
    }
    throw error;
  }
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  );
}

async function readOptionalFile(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (isMissingFile(error)) return null;
    throw error;
  }
}

async function removeFileIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (!isMissingFile(error)) throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
