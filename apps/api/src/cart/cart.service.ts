import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service';

const GUEST_CART_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_CART_LINES = 50;
const cartStateSchema = z.object({
  items: z.array(
    z.object({
      variantId: z.string().min(1),
      quantity: z.number().int().min(1).max(99),
      unitPriceVnd: z.number().int().nonnegative(),
    }),
  ),
});
type GuestCartState = z.infer<typeof cartStateSchema>;

const variantInclude = {
  product: { include: { images: { orderBy: { position: 'asc' as const }, take: 1 } } },
};

type CartVariant = Prisma.ProductVariantGetPayload<{ include: typeof variantInclude }>;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getCart(userId?: string, guestId?: string) {
    if (userId) {
      const cart = await this.prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
        include: { items: { include: { variant: { include: variantInclude } } } },
      });
      const items = await Promise.all(
        cart.items.map(async (item) => {
          const currentPrice = effectivePrice(item.variant.product);
          if (item.unitPriceVnd !== currentPrice) {
            await this.prisma.cartItem.update({
              where: { id: item.id },
              data: { unitPriceVnd: currentPrice },
            });
          }
          return formatItem(
            item.variant,
            item.quantity,
            currentPrice,
            item.variant.stockOnHand,
            item.variant.product.publishedAt !== null,
          );
        }),
      );
      return formatCart(items);
    }
    const state = await this.readGuestCart(guestId);
    const items = await this.refreshGuestItems(state);
    await this.writeGuestCart(guestId, state);
    return formatCart(items);
  }

  async addItem(
    userId: string | undefined,
    guestId: string | undefined,
    variantId: string,
    quantity: number,
  ) {
    const variant = await this.getAvailableVariant(variantId);
    if (userId) {
      const cart = await this.prisma.cart.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
      const existing = await this.prisma.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
      });
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      this.assertQuantity(nextQuantity, variant.stockOnHand);
      if (
        !existing &&
        (await this.prisma.cartItem.count({ where: { cartId: cart.id } })) >= MAX_CART_LINES
      ) {
        throw new BadRequestException('Giỏ hàng đã đạt số sản phẩm tối đa.');
      }
      await this.prisma.cartItem.upsert({
        where: { cartId_variantId: { cartId: cart.id, variantId } },
        create: {
          cartId: cart.id,
          variantId,
          quantity: nextQuantity,
          unitPriceVnd: effectivePrice(variant.product),
        },
        update: { quantity: nextQuantity, unitPriceVnd: effectivePrice(variant.product) },
      });
    } else {
      const state = await this.readGuestCart(guestId);
      const existing = state.items.find((item) => item.variantId === variantId);
      const nextQuantity = (existing?.quantity ?? 0) + quantity;
      this.assertQuantity(nextQuantity, variant.stockOnHand);
      if (!existing && state.items.length >= MAX_CART_LINES) {
        throw new BadRequestException('Giỏ hàng đã đạt số sản phẩm tối đa.');
      }
      if (existing) {
        existing.quantity = nextQuantity;
        existing.unitPriceVnd = effectivePrice(variant.product);
      } else {
        state.items.push({
          variantId,
          quantity: nextQuantity,
          unitPriceVnd: effectivePrice(variant.product),
        });
      }
      await this.writeGuestCart(guestId, state);
    }
    return this.getCart(userId, guestId);
  }

  async setQuantity(
    userId: string | undefined,
    guestId: string | undefined,
    variantId: string,
    quantity: number,
  ) {
    const variant = await this.getAvailableVariant(variantId);
    this.assertQuantity(quantity, variant.stockOnHand);
    if (userId) {
      const cart = await this.prisma.cart.findUnique({ where: { userId } });
      if (!cart) throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng.');
      const updated = await this.prisma.cartItem.updateMany({
        where: { cartId: cart.id, variantId },
        data: { quantity, unitPriceVnd: effectivePrice(variant.product) },
      });
      if (!updated.count) throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng.');
    } else {
      const state = await this.readGuestCart(guestId);
      const item = state.items.find((line) => line.variantId === variantId);
      if (!item) throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng.');
      item.quantity = quantity;
      item.unitPriceVnd = effectivePrice(variant.product);
      await this.writeGuestCart(guestId, state);
    }
    return this.getCart(userId, guestId);
  }

  async removeItem(userId: string | undefined, guestId: string | undefined, variantId: string) {
    if (userId) {
      const cart = await this.prisma.cart.findUnique({ where: { userId } });
      if (!cart) throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng.');
      const removed = await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id, variantId },
      });
      if (!removed.count) throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng.');
    } else {
      const state = await this.readGuestCart(guestId);
      const nextItems = state.items.filter((item) => item.variantId !== variantId);
      if (nextItems.length === state.items.length) {
        throw new NotFoundException('Không tìm thấy sản phẩm trong giỏ hàng.');
      }
      state.items = nextItems;
      await this.writeGuestCart(guestId, state);
    }
    return this.getCart(userId, guestId);
  }

  async mergeGuestCart(userId: string, guestId?: string): Promise<void> {
    if (!guestId || !/^[A-Za-z0-9_-]{32,64}$/.test(guestId)) return;
    const state = await this.readGuestCart(guestId);
    if (state.items.length === 0) return;
    const guestIdHash = createHash('sha256').update(guestId).digest('hex');
    try {
      await this.prisma.$transaction(async (transaction) => {
        const receipt = await transaction.cartMergeReceipt.findUnique({ where: { guestIdHash } });
        if (receipt) {
          if (receipt.userId !== userId)
            throw new ConflictException('Giỏ hàng khách đã được liên kết.');
          return;
        }
        const cart = await transaction.cart.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        for (const item of state.items) {
          const variant = await transaction.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true },
          });
          if (!variant) {
            throw new ConflictException(
              'Một sản phẩm trong giỏ khách không còn trong danh mục. Hãy tải lại giỏ trước khi đăng nhập.',
            );
          }
          const existing = await transaction.cartItem.findUnique({
            where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
          });
          const quantity = (existing?.quantity ?? 0) + item.quantity;
          if (quantity > 99) {
            throw new ConflictException(
              'Tổng số lượng vượt quá 99 sản phẩm. Hãy xóa sản phẩm này khỏi giỏ khách trước khi đăng nhập.',
            );
          }
          await transaction.cartItem.upsert({
            where: { cartId_variantId: { cartId: cart.id, variantId: item.variantId } },
            create: {
              cartId: cart.id,
              variantId: item.variantId,
              quantity,
              unitPriceVnd: effectivePrice(variant.product),
            },
            update: { quantity, unitPriceVnd: effectivePrice(variant.product) },
          });
        }
        await transaction.cartMergeReceipt.create({ data: { guestIdHash, userId } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const receipt = await this.prisma.cartMergeReceipt.findUnique({ where: { guestIdHash } });
        if (receipt?.userId === userId) return;
      }
      throw error;
    }
    await this.redis.del(this.redisKey(guestId));
  }

  private async getAvailableVariant(variantId: string): Promise<CartVariant> {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        product: { publishedAt: { not: null } },
      },
      include: { ...variantInclude },
    });
    if (!variant) throw new NotFoundException('Không tìm thấy sản phẩm.');
    if (variant.stockOnHand < 1) throw new ConflictException('Sản phẩm hiện đã hết hàng.');
    return variant;
  }

  private async refreshGuestItems(state: GuestCartState) {
    const result = [];
    for (const item of state.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
        include: { ...variantInclude },
      });
      if (!variant) {
        result.push({
          variantId: item.variantId,
          sku: item.variantId,
          variantName: '',
          productSlug: '',
          productName: 'Sản phẩm không còn trong danh mục',
          image: '',
          quantity: item.quantity,
          unitPriceVnd: item.unitPriceVnd,
          lineTotalVnd: item.unitPriceVnd * item.quantity,
          stockAvailable: 0,
          exceedsStock: true,
          isAvailable: false,
        });
        continue;
      }
      item.unitPriceVnd = effectivePrice(variant.product);
      result.push(
        formatItem(
          variant,
          item.quantity,
          item.unitPriceVnd,
          variant.stockOnHand,
          variant.product.publishedAt !== null,
        ),
      );
    }
    return result;
  }

  private async readGuestCart(guestId?: string): Promise<GuestCartState> {
    if (!guestId || !/^[A-Za-z0-9_-]{32,64}$/.test(guestId)) return { items: [] };
    const value = await this.redis.get(this.redisKey(guestId));
    if (value === null) return { items: [] };
    const parsed: unknown = JSON.parse(value);
    const result = cartStateSchema.safeParse(parsed);
    if (!result.success) throw new Error('Stored guest cart has an invalid format.');
    return result.data;
  }

  private async writeGuestCart(guestId: string | undefined, state: GuestCartState): Promise<void> {
    if (!guestId || !/^[A-Za-z0-9_-]{32,64}$/.test(guestId)) {
      throw new BadRequestException('Phiên giỏ hàng không hợp lệ.');
    }
    await this.redis.set(
      this.redisKey(guestId),
      JSON.stringify(state),
      'EX',
      GUEST_CART_TTL_SECONDS,
    );
  }

  private redisKey(guestId: string): string {
    return `cart:guest:${guestId}`;
  }

  private assertQuantity(quantity: number, stock: number): void {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new BadRequestException('Số lượng phải từ 1 đến 99.');
    }
    if (quantity > stock) {
      throw new ConflictException(`Chỉ còn ${stock} sản phẩm trong kho.`);
    }
  }
}

function effectivePrice(product: { priceVnd: number; salePriceVnd: number | null }): number {
  return product.salePriceVnd ?? product.priceVnd;
}

function formatItem(
  variant: CartVariant,
  quantity: number,
  unitPriceVnd: number,
  stock: number,
  isAvailable: boolean,
) {
  const product = variant.product;
  return {
    variantId: variant.id,
    sku: variant.sku,
    variantName: variant.name,
    productSlug: product.slug,
    productName: product.name,
    image: product.images[0]?.url ?? `/products/${product.slug}.svg`,
    quantity,
    unitPriceVnd,
    lineTotalVnd: unitPriceVnd * quantity,
    stockAvailable: stock,
    exceedsStock: quantity > stock,
    isAvailable,
  };
}

function formatCart<T extends { quantity: number; lineTotalVnd: number }>(items: T[]) {
  return {
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    subtotalVnd: items.reduce((subtotal, item) => subtotal + item.lineTotalVnd, 0),
  };
}
