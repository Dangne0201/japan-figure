import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoyaltyTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  VoucherType,
  type Order,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeQueue, type ProductKnowledgeQueue } from '../knowledge/knowledge-queue.service';
import type { CheckoutQuoteDto, PlaceOrderDto } from './checkout.dto';
import {
  calculateCheckoutAmounts,
  calculateLoyaltyDiscount,
  calculateShippingOptions,
  calculateVoucherDiscount,
} from './pricing';

const checkoutCartInclude = {
  items: {
    include: {
      variant: { include: { product: true } },
    },
  },
} satisfies Prisma.CartInclude;

type CheckoutDatabase = PrismaService | Prisma.TransactionClient;

interface CheckoutLine {
  productVariantId: string;
  productSlug: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  unitPriceVnd: number;
  weightGrams: number;
  stockAvailable: number;
  productId: string;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KnowledgeQueue) private readonly knowledgeQueue: ProductKnowledgeQueue,
  ) {}

  quote(userId: string, input: CheckoutQuoteDto) {
    return this.buildQuote(this.prisma, userId, input);
  }

  async placeOrder(userId: string, input: PlaceOrderDto): Promise<Order> {
    let changedProductIds: string[] = [];
    try {
      const order = await this.prisma.$transaction(
        async (transaction) => {
          const quote = await this.buildQuote(transaction, userId, input);
          changedProductIds = [...new Set(quote.lines.map((line) => line.productId))];
          const cart = await transaction.cart.findUnique({ where: { userId } });
          if (!cart) throw new BadRequestException('Giỏ hàng đang trống.');

          for (const line of quote.lines) {
            const updated = await transaction.$executeRaw`
              UPDATE "product_variants"
              SET "stock_reserved" = "stock_reserved" + ${line.quantity},
                  "updated_at" = CURRENT_TIMESTAMP
              WHERE "id" = ${line.productVariantId}
                AND "stock_on_hand" - "stock_reserved" >= ${line.quantity}
            `;
            if (updated !== 1) {
              throw new ConflictException(`Sản phẩm ${line.productName} vừa hết hàng.`);
            }
          }

          const account = await transaction.loyaltyAccount.upsert({
            where: { userId },
            create: { userId },
            update: {},
          });
          if (quote.amounts.pointsRedeemed > 0) {
            const updated = await transaction.loyaltyAccount.updateMany({
              where: { id: account.id, pointsBalance: { gte: quote.amounts.pointsRedeemed } },
              data: { pointsBalance: { decrement: quote.amounts.pointsRedeemed } },
            });
            if (updated.count !== 1) {
              throw new ConflictException('Số điểm đã thay đổi. Vui lòng tính lại đơn hàng.');
            }
          }

          const paymentMethod = input.paymentMethod ?? PaymentMethod.MOCK_TRANSFER;
          const now = new Date();
          const paymentDeadlineAt = new Date(
            now.getTime() +
              (paymentMethod === PaymentMethod.MOCK_TRANSFER ? 15 * 60_000 : 30 * 24 * 60 * 60_000),
          );
          const initialStatus =
            paymentMethod === PaymentMethod.MOCK_COD
              ? OrderStatus.PROCESSING
              : OrderStatus.PENDING_PAYMENT;
          const order = await transaction.order.create({
            data: {
              orderNumber: createOrderNumber(),
              userId,
              status: initialStatus,
              recipientName: quote.address.recipientName,
              phone: quote.address.phone,
              streetAddress: quote.address.streetAddress,
              provinceCode: quote.address.provinceCode,
              provinceName: quote.address.provinceName,
              communeCode: quote.address.communeCode,
              communeName: quote.address.communeName,
              communeType: quote.address.communeType,
              carrierId: quote.shipping.carrierId,
              carrierName: quote.shipping.carrierName,
              estimatedDeliveryFrom: new Date(
                `${quote.shipping.estimatedDeliveryFrom}T00:00:00.000Z`,
              ),
              estimatedDeliveryTo: new Date(`${quote.shipping.estimatedDeliveryTo}T00:00:00.000Z`),
              subtotalVnd: quote.amounts.subtotalVnd,
              voucherDiscountVnd: quote.amounts.voucherDiscountVnd,
              loyaltyDiscountVnd: quote.amounts.loyaltyDiscountVnd,
              shippingFeeVnd: quote.amounts.shippingFeeVnd,
              totalVnd: quote.amounts.totalVnd,
              pointsEarned: quote.amounts.pointsEarned,
              pointsRedeemed: quote.amounts.pointsRedeemed,
              paymentDeadlineAt,
              items: {
                create: quote.lines.map((line) => ({
                  productVariantId: line.productVariantId,
                  productSlug: line.productSlug,
                  productName: line.productName,
                  variantName: line.variantName,
                  sku: line.sku,
                  quantity: line.quantity,
                  unitPriceVnd: line.unitPriceVnd,
                  weightGrams: line.weightGrams,
                })),
              },
              payment: {
                create: {
                  method: paymentMethod,
                  status: PaymentStatus.PENDING,
                  amountVnd: quote.amounts.totalVnd,
                  expiresAt: paymentDeadlineAt,
                },
              },
              reservations: {
                create: quote.lines.map((line) => ({
                  variantId: line.productVariantId,
                  quantity: line.quantity,
                  status: ReservationStatus.ACTIVE,
                  expiresAt: paymentDeadlineAt,
                })),
              },
              statusHistory: {
                create: {
                  toStatus: initialStatus,
                  reason:
                    paymentMethod === PaymentMethod.MOCK_COD
                      ? 'Tạo đơn COD mô phỏng; thu tiền khi giao hàng.'
                      : 'Chờ kết quả chuyển khoản mô phỏng.',
                },
              },
            },
          });

          if (quote.voucherId) {
            await transaction.voucherRedemption.create({
              data: { voucherId: quote.voucherId, userId, orderId: order.id },
            });
          }
          if (quote.amounts.pointsRedeemed > 0) {
            await transaction.loyaltyTransaction.create({
              data: {
                loyaltyAccountId: account.id,
                orderId: order.id,
                type: LoyaltyTransactionType.REDEEM,
                pointsDelta: -quote.amounts.pointsRedeemed,
              },
            });
          }
          await transaction.cartItem.deleteMany({ where: { cartId: cart.id } });
          return transaction.order.findUniqueOrThrow({
            where: { id: order.id },
            include: { payment: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await Promise.all(
        changedProductIds.map((productId) => this.knowledgeQueue.enqueueProduct(productId)),
      );
      return order;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Đơn hàng vừa thay đổi. Vui lòng tính lại trước khi đặt.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'Không thể ghi nhận ưu đãi hoặc đơn hàng đồng thời. Vui lòng thử lại.',
        );
      }
      throw error;
    }
  }

  private async buildQuote(database: CheckoutDatabase, userId: string, input: CheckoutQuoteDto) {
    const [address, cart, loyaltyAccount] = await Promise.all([
      database.address.findFirst({ where: { id: input.addressId, userId } }),
      database.cart.findUnique({ where: { userId }, include: checkoutCartInclude }),
      database.loyaltyAccount.findUnique({ where: { userId } }),
    ]);
    if (!address) throw new NotFoundException('Không tìm thấy địa chỉ nhận hàng.');
    if (!cart?.items.length) throw new BadRequestException('Giỏ hàng đang trống.');

    const lines: CheckoutLine[] = cart.items.map((item) => {
      const { variant } = item;
      const product = variant.product;
      if (!product.publishedAt) {
        throw new ConflictException(`Sản phẩm ${product.name} hiện không còn được bán.`);
      }
      const stockAvailable = variant.stockOnHand - variant.stockReserved;
      if (stockAvailable < item.quantity) {
        throw new ConflictException(
          `${product.name} chỉ còn ${stockAvailable} sản phẩm khả dụng trong kho.`,
        );
      }
      if (!Number.isSafeInteger(variant.weightGrams) || variant.weightGrams < 1) {
        throw new BadRequestException(`Chưa có khối lượng hợp lệ cho ${product.name}.`);
      }
      return {
        productId: product.id,
        productVariantId: variant.id,
        productSlug: product.slug,
        productName: product.name,
        variantName: variant.name,
        sku: variant.sku,
        quantity: item.quantity,
        unitPriceVnd: product.salePriceVnd ?? product.priceVnd,
        weightGrams: variant.weightGrams,
        stockAvailable,
      };
    });

    const subtotalVnd = lines.reduce(
      (subtotal, line) => subtotal + line.unitPriceVnd * line.quantity,
      0,
    );
    if (!Number.isSafeInteger(subtotalVnd)) {
      throw new BadRequestException('Tổng giá trị giỏ hàng vượt giới hạn hỗ trợ.');
    }

    const voucherCode = input.voucherCode?.trim().toUpperCase();
    const voucher = voucherCode
      ? await database.voucher.findUnique({ where: { code: voucherCode } })
      : null;
    if (voucherCode && !voucher) throw new BadRequestException('Mã ưu đãi không tồn tại.');
    if (voucher) {
      const now = new Date();
      if (now < voucher.startsAt || now >= voucher.expiresAt) {
        throw new BadRequestException('Mã ưu đãi chưa bắt đầu hoặc đã hết hạn.');
      }
      if (subtotalVnd < voucher.minSubtotalVnd) {
        throw new BadRequestException(
          `Đơn hàng cần đạt tối thiểu ${voucher.minSubtotalVnd.toLocaleString('vi-VN')} ₫ để dùng mã.`,
        );
      }
      const [totalUses, userUses] = await Promise.all([
        database.voucherRedemption.count({ where: { voucherId: voucher.id } }),
        database.voucherRedemption.count({ where: { voucherId: voucher.id, userId } }),
      ]);
      if (voucher.totalLimit !== null && totalUses >= voucher.totalLimit) {
        throw new BadRequestException('Mã ưu đãi đã hết lượt sử dụng.');
      }
      if (voucher.perUserLimit !== null && userUses >= voucher.perUserLimit) {
        throw new BadRequestException('Bạn đã sử dụng hết lượt của mã ưu đãi này.');
      }
      if (!voucher.isStackable && (input.redeemPoints ?? 0) > 0) {
        throw new BadRequestException('Mã ưu đãi này không áp dụng đồng thời với điểm tích lũy.');
      }
    }

    const voucherDiscountVnd = calculateVoucherDiscount(
      subtotalVnd,
      voucher
        ? {
            type: voucher.type,
            value: voucher.value,
            maxDiscountVnd: voucher.maxDiscountVnd,
          }
        : undefined,
    );
    const merchandiseAfterVoucher = subtotalVnd - voucherDiscountVnd;
    const weightGrams = lines.reduce(
      (weight, line) => weight + line.weightGrams * line.quantity,
      0,
    );
    let shippingOptions: ReturnType<typeof calculateShippingOptions>;
    try {
      shippingOptions = calculateShippingOptions(
        address.provinceCode,
        weightGrams,
        merchandiseAfterVoucher,
        voucher?.type === VoucherType.FREE_SHIPPING,
      );
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
    const shipping =
      shippingOptions.find((option) => option.carrierId === input.carrierId) ??
      (input.carrierId ? undefined : shippingOptions[0]);
    if (!shipping) throw new BadRequestException('Đơn vị vận chuyển mô phỏng không hợp lệ.');

    const availablePoints = loyaltyAccount?.pointsBalance ?? 0;
    let loyalty: ReturnType<typeof calculateLoyaltyDiscount>;
    try {
      loyalty = calculateLoyaltyDiscount(
        input.redeemPoints ?? 0,
        availablePoints,
        merchandiseAfterVoucher,
      );
    } catch (error) {
      if (error instanceof RangeError) throw new BadRequestException(error.message);
      throw error;
    }
    const amounts = calculateCheckoutAmounts({
      subtotalVnd,
      voucherDiscountVnd,
      loyaltyDiscountVnd: loyalty.discountVnd,
      shippingFeeVnd: shipping.feeVnd,
      pointsRedeemed: loyalty.pointsRedeemed,
    });

    return {
      address,
      lines,
      shipping,
      shippingOptions,
      amounts,
      voucherId: voucher?.id ?? null,
      voucherCode: voucher?.code ?? null,
      loyaltyPointsAvailable: availablePoints,
      freeShippingThresholdVnd: 1_500_000,
    };
  }
}

function createOrderNumber(): string {
  return `JF-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
}
