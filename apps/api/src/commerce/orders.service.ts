import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentOutcome,
  PaymentStatus,
  Prisma,
  ReviewStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { KnowledgeQueue, type ProductKnowledgeQueue } from '../knowledge/knowledge-queue.service';
import { releaseOrderCommitments, transitionOrder } from './order-lifecycle';
import type {
  AddWishlistItemDto,
  CreateReturnRequestDto,
  CreateReviewDto,
  PaymentOutcomeDto,
} from './orders.dto';

const orderDetails = {
  payment: { select: { method: true, status: true, amountVnd: true, expiresAt: true } },
  items: { include: { review: { select: { id: true, status: true } } } },
  statusHistory: { orderBy: { createdAt: 'asc' as const } },
  returnRequest: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KnowledgeQueue) private readonly knowledgeQueue: ProductKnowledgeQueue,
  ) {}

  async list(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: orderDetails,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async detail(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderDetails,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return order;
  }

  async invoice(userId: string, orderId: string) {
    const order = await this.detail(userId, orderId);
    return { simulation: true, invoiceNumber: order.orderNumber, order };
  }

  async recordPaymentOutcome(userId: string, orderId: string, input: PaymentOutcomeDto) {
    let changedProductIds: string[] = [];
    try {
      const orderResult = await this.prisma.$transaction(
        async (transaction) => {
          const order = await transaction.order.findFirst({
            where: { id: orderId, userId },
            include: { payment: true },
          });
          if (!order?.payment) throw new NotFoundException('Không tìm thấy giao dịch mô phỏng.');

          if (order.payment.method !== PaymentMethod.MOCK_TRANSFER) {
            throw new ConflictException('Đơn COD không có bước xác nhận chuyển khoản mô phỏng.');
          }

          const priorEvent = await transaction.paymentEvent.findUnique({
            where: {
              paymentId_eventId: { paymentId: order.payment.id, eventId: input.eventId },
            },
          });
          if (priorEvent) {
            if (priorEvent.outcome !== input.outcome) {
              throw new ConflictException('Mã sự kiện đã được dùng cho kết quả thanh toán khác.');
            }
            return transaction.order.findUniqueOrThrow({
              where: { id: order.id },
              include: orderDetails,
            });
          }

          if (
            order.status !== OrderStatus.PENDING_PAYMENT ||
            order.payment.status !== PaymentStatus.PENDING
          ) {
            throw new ConflictException('Đơn hàng không còn chờ kết quả thanh toán.');
          }

          await transaction.paymentEvent.create({
            data: {
              paymentId: order.payment.id,
              eventId: input.eventId,
              outcome: input.outcome,
            },
          });

          if (input.outcome === PaymentOutcome.SUCCESS) {
            await transaction.payment.update({
              where: { id: order.payment.id },
              data: { status: PaymentStatus.SUCCEEDED },
            });
            await transitionOrder(transaction, order, OrderStatus.PAID, {
              actorUserId: userId,
              reason: 'Kết quả chuyển khoản mô phỏng thành công.',
            });
          } else {
            const nextStatus =
              input.outcome === PaymentOutcome.FAILURE
                ? OrderStatus.PAYMENT_FAILED
                : OrderStatus.CANCELLED;
            await transaction.payment.update({
              where: { id: order.payment.id },
              data: {
                status:
                  input.outcome === PaymentOutcome.FAILURE
                    ? PaymentStatus.FAILED
                    : PaymentStatus.CANCELLED,
              },
            });
            await transitionOrder(transaction, order, nextStatus, {
              actorUserId: userId,
              reason:
                input.outcome === PaymentOutcome.FAILURE
                  ? 'Thanh toán mô phỏng thất bại.'
                  : 'Khách hủy thanh toán mô phỏng.',
            });
            changedProductIds = await releaseOrderCommitments(transaction, order);
          }

          return transaction.order.findUniqueOrThrow({
            where: { id: order.id },
            include: orderDetails,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.enqueueChangedProducts(changedProductIds);
      return orderResult;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Thanh toán vừa được cập nhật. Hãy tải lại đơn hàng.');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Kết quả thanh toán đã được ghi nhận.');
      }
      throw error;
    }
  }

  async cancel(userId: string, orderId: string) {
    let changedProductIds: string[] = [];
    try {
      const orderResult = await this.prisma.$transaction(
        async (transaction) => {
          const order = await transaction.order.findFirst({
            where: { id: orderId, userId },
            include: { payment: true },
          });
          if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
          if (!order.payment) throw new NotFoundException('Không tìm thấy giao dịch của đơn hàng.');
          const cancellableTransfer =
            order.status === OrderStatus.PENDING_PAYMENT &&
            order.payment.method === PaymentMethod.MOCK_TRANSFER;
          const cancellableCod =
            order.status === OrderStatus.PROCESSING &&
            order.payment.method === PaymentMethod.MOCK_COD;
          if (!cancellableTransfer && !cancellableCod) {
            throw new ConflictException('Đơn hàng hiện không thể hủy trong mô phỏng.');
          }

          if (order.payment.status === PaymentStatus.PENDING) {
            await transaction.payment.update({
              where: { id: order.payment.id },
              data: { status: PaymentStatus.CANCELLED },
            });
          }
          await transitionOrder(transaction, order, OrderStatus.CANCELLED, {
            actorUserId: userId,
            reason: 'Khách yêu cầu hủy đơn mô phỏng.',
          });
          changedProductIds = await releaseOrderCommitments(transaction, order);
          return transaction.order.findUniqueOrThrow({
            where: { id: order.id },
            include: orderDetails,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.enqueueChangedProducts(changedProductIds);
      return orderResult;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Đơn hàng vừa được cập nhật. Hãy tải lại trạng thái mới nhất.');
      }
      throw error;
    }
  }

  async requestReturn(userId: string, orderId: string, input: CreateReturnRequestDto) {
    const reason = input.reason.trim();
    if (!reason) throw new BadRequestException('Hãy nhập lý do yêu cầu trả hàng.');
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const order = await transaction.order.findFirst({ where: { id: orderId, userId } });
        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
        if (order.status !== OrderStatus.DELIVERED) {
          throw new ConflictException('Chỉ có thể gửi yêu cầu cho đơn đã giao.');
        }

        const returnDeadline = order.deliveredAt
          ? order.deliveredAt.getTime() + 7 * 24 * 60 * 60_000
          : 0;
        if (!order.deliveredAt || Date.now() > returnDeadline) {
          throw new ConflictException('Thời hạn yêu cầu trả hàng mô phỏng là 7 ngày sau khi giao.');
        }
        const request = await transaction.returnRequest.create({
          data: { orderId, userId, reason },
        });
        await transitionOrder(transaction, order, OrderStatus.RETURN_REQUESTED, {
          actorUserId: userId,
          reason: 'Đã tiếp nhận yêu cầu trả hàng mô phỏng.',
        });
        return {
          request,
          order: await transaction.order.findUniqueOrThrow({
            where: { id: orderId },
            include: orderDetails,
          }),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Đơn hàng đã có yêu cầu trả hàng.');
      }
      throw error;
    }
  }

  async wishlist(userId: string) {
    const items = await this.prisma.wishlistItem.findMany({
      where: { userId, product: { publishedAt: { not: null } } },
      include: {
        product: {
          select: {
            slug: true,
            name: true,
            characterName: true,
            priceVnd: true,
            salePriceVnd: true,
            images: { orderBy: { position: 'asc' }, take: 1, select: { url: true, altText: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return items;
  }

  async addWishlistItem(userId: string, input: AddWishlistItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { slug: input.productSlug, publishedAt: { not: null } },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm đang được bán.');
    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId: product.id } },
      create: { userId, productId: product.id },
      update: {},
    });
  }

  async removeWishlistItem(userId: string, productSlug: string) {
    await this.prisma.wishlistItem.deleteMany({
      where: { userId, product: { slug: productSlug } },
    });
    return { removed: true };
  }

  async createReview(userId: string, input: CreateReviewDto) {
    const body = input.body.trim();
    if (!body) throw new BadRequestException('Nội dung đánh giá không được để trống.');
    const item = await this.prisma.orderItem.findFirst({
      where: {
        id: input.orderItemId,
        order: { userId, status: OrderStatus.DELIVERED },
      },
      select: { id: true, productSlug: true },
    });
    if (!item) {
      throw new ConflictException('Chỉ người mua đã nhận hàng mới có thể đánh giá sản phẩm.');
    }
    const product = await this.prisma.product.findUnique({
      where: { slug: item.productSlug },
      select: { id: true },
    });
    if (!product) throw new ConflictException('Không tìm thấy sản phẩm trong danh mục.');

    try {
      return await this.prisma.review.create({
        data: {
          userId,
          productId: product.id,
          orderItemId: item.id,
          rating: input.rating,
          body,
          status: ReviewStatus.PENDING,
        },
        select: { id: true, rating: true, body: true, status: true, createdAt: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Sản phẩm trong đơn này đã được đánh giá.');
      }
      throw error;
    }
  }

  private async enqueueChangedProducts(productIds: string[]): Promise<void> {
    await Promise.all(productIds.map((productId) => this.knowledgeQueue.enqueueProduct(productId)));
  }
}
