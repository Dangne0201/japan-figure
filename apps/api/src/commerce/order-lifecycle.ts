import { ConflictException } from '@nestjs/common';
import {
  LoyaltyTransactionType,
  OrderStatus,
  ReservationStatus,
  type Order,
  type Prisma,
} from '@prisma/client';

type Transaction = Prisma.TransactionClient;

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  SIMULATED: [],
  PENDING_PAYMENT: [
    OrderStatus.PAID,
    OrderStatus.PAYMENT_FAILED,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  PAID: [OrderStatus.PROCESSING],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED],
  DELIVERED: [OrderStatus.RETURN_REQUESTED],
  PAYMENT_FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  RETURN_REQUESTED: [OrderStatus.RETURNED, OrderStatus.DELIVERED],
  RETURNED: [],
};

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!allowedTransitions[from].includes(to)) {
    throw new ConflictException(`Không thể chuyển trạng thái đơn từ ${from} sang ${to}.`);
  }
}

export async function transitionOrder(
  transaction: Transaction,
  order: Pick<Order, 'id' | 'status'>,
  toStatus: OrderStatus,
  options: { actorUserId?: string; reason?: string; preserveDeliveredAt?: boolean } = {},
): Promise<void> {
  assertOrderTransition(order.status, toStatus);
  const updatedAt = new Date();
  const updated = await transaction.order.updateMany({
    where: { id: order.id, status: order.status },
    data: {
      status: toStatus,
      statusUpdatedAt: updatedAt,
      ...(toStatus === OrderStatus.DELIVERED && !options.preserveDeliveredAt
        ? { deliveredAt: updatedAt }
        : {}),
    },
  });
  if (updated.count !== 1) {
    throw new ConflictException('Đơn hàng vừa được cập nhật. Hãy tải lại trạng thái mới nhất.');
  }
  await transaction.orderStatusHistory.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus,
      ...(options.actorUserId ? { actorUserId: options.actorUserId } : {}),
      ...(options.reason ? { reason: options.reason } : {}),
    },
  });
}

export async function releaseOrderCommitments(
  transaction: Transaction,
  order: Pick<Order, 'id' | 'userId' | 'pointsRedeemed'>,
): Promise<string[]> {
  const reservations = await transaction.stockReservation.findMany({
    where: { orderId: order.id, status: ReservationStatus.ACTIVE },
    select: { variantId: true, quantity: true },
  });
  const variants = reservations.length
    ? await transaction.productVariant.findMany({
        where: { id: { in: reservations.map(({ variantId }) => variantId) } },
        select: { productId: true },
      })
    : [];
  for (const reservation of reservations) {
    const updated = await transaction.productVariant.updateMany({
      where: { id: reservation.variantId, stockReserved: { gte: reservation.quantity } },
      data: { stockReserved: { decrement: reservation.quantity } },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Không thể giải phóng lượng hàng đã giữ. Cần kiểm tra tồn kho.');
    }
  }
  if (reservations.length) {
    await transaction.stockReservation.updateMany({
      where: { orderId: order.id, status: ReservationStatus.ACTIVE },
      data: { status: ReservationStatus.RELEASED },
    });
  }

  if (order.pointsRedeemed > 0) {
    const priorRelease = await transaction.loyaltyTransaction.findUnique({
      where: { orderId_type: { orderId: order.id, type: LoyaltyTransactionType.RELEASE } },
    });
    if (!priorRelease) {
      const account = await transaction.loyaltyAccount.upsert({
        where: { userId: order.userId },
        create: { userId: order.userId, pointsBalance: order.pointsRedeemed },
        update: { pointsBalance: { increment: order.pointsRedeemed } },
      });
      await transaction.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          orderId: order.id,
          type: LoyaltyTransactionType.RELEASE,
          pointsDelta: order.pointsRedeemed,
        },
      });
    }
  }

  await transaction.voucherRedemption.deleteMany({ where: { orderId: order.id } });
  return [...new Set(variants.map(({ productId }) => productId))];
}

export async function consumeOrderReservations(
  transaction: Transaction,
  orderId: string,
): Promise<string[]> {
  const reservations = await transaction.stockReservation.findMany({
    where: { orderId, status: ReservationStatus.ACTIVE },
    select: { variantId: true, quantity: true },
  });
  const variants = reservations.length
    ? await transaction.productVariant.findMany({
        where: { id: { in: reservations.map(({ variantId }) => variantId) } },
        select: { productId: true },
      })
    : [];
  for (const reservation of reservations) {
    const updated = await transaction.productVariant.updateMany({
      where: {
        id: reservation.variantId,
        stockOnHand: { gte: reservation.quantity },
        stockReserved: { gte: reservation.quantity },
      },
      data: {
        stockOnHand: { decrement: reservation.quantity },
        stockReserved: { decrement: reservation.quantity },
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Không thể xác nhận tồn kho khi giao hàng.');
    }
  }
  if (reservations.length) {
    await transaction.stockReservation.updateMany({
      where: { orderId, status: ReservationStatus.ACTIVE },
      data: { status: ReservationStatus.CONSUMED },
    });
  }
  return [...new Set(variants.map(({ productId }) => productId))];
}
