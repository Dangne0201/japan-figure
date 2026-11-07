import {
  LoyaltyTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentOutcome,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import {
  consumeOrderReservations,
  releaseOrderCommitments,
  transitionOrder,
} from './order-lifecycle';
import type { AppConfig } from '../config/env';

const fulfillmentDelayMs: Partial<Record<OrderStatus, number>> = {
  [OrderStatus.PAID]: 15_000,
  [OrderStatus.PROCESSING]: 30_000,
  [OrderStatus.SHIPPED]: 30_000,
};

const statusLabels: Record<OrderStatus, string> = {
  SIMULATED: 'Đơn mô phỏng cũ',
  PENDING_PAYMENT: 'Đang chờ thanh toán mô phỏng',
  PAID: 'Đã ghi nhận thanh toán mô phỏng',
  PROCESSING: 'Đang chuẩn bị hàng mô phỏng',
  SHIPPED: 'Đang giao hàng mô phỏng',
  DELIVERED: 'Đã giao hàng mô phỏng',
  PAYMENT_FAILED: 'Thanh toán mô phỏng thất bại',
  CANCELLED: 'Đã hủy đơn mô phỏng',
  EXPIRED: 'Đơn mô phỏng hết hạn thanh toán',
  RETURN_REQUESTED: 'Đã nhận yêu cầu trả hàng mô phỏng',
  RETURNED: 'Đã hoàn tất trả hàng mô phỏng',
};

export async function runOrderLifecycleSweep(
  prisma: PrismaClient,
  mailer: Transporter,
  config: AppConfig,
  now = new Date(),
): Promise<void> {
  await expirePendingPayments(prisma, now);
  await advanceFulfillment(prisma, now);
  await sendPendingNotifications(prisma, mailer, config);
}

async function expirePendingPayments(prisma: PrismaClient, now: Date): Promise<void> {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PENDING_PAYMENT,
      payment: {
        is: {
          method: PaymentMethod.MOCK_TRANSFER,
          status: PaymentStatus.PENDING,
          expiresAt: { lte: now },
        },
      },
    },
    select: { id: true },
    take: 100,
  });

  for (const { id } of expiredOrders) {
    await prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findFirst({
          where: {
            id,
            status: OrderStatus.PENDING_PAYMENT,
            payment: {
              is: {
                method: PaymentMethod.MOCK_TRANSFER,
                status: PaymentStatus.PENDING,
                expiresAt: { lte: now },
              },
            },
          },
          include: { payment: true },
        });
        if (!order?.payment) return;

        await transaction.payment.update({
          where: { id: order.payment.id },
          data: { status: PaymentStatus.EXPIRED },
        });
        await transitionOrder(transaction, order, OrderStatus.EXPIRED, {
          reason: 'Hết thời hạn thanh toán mô phỏng.',
        });
        await releaseOrderCommitments(transaction, order);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

async function advanceFulfillment(prisma: PrismaClient, now: Date): Promise<void> {
  const candidates = await prisma.order.findMany({
    where: {
      status: { in: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.SHIPPED] },
      OR: [
        {
          status: OrderStatus.PAID,
          statusUpdatedAt: { lte: new Date(now.getTime() - fulfillmentDelayMs.PAID!) },
        },
        {
          status: OrderStatus.PROCESSING,
          statusUpdatedAt: {
            lte: new Date(now.getTime() - fulfillmentDelayMs.PROCESSING!),
          },
        },
        {
          status: OrderStatus.SHIPPED,
          statusUpdatedAt: { lte: new Date(now.getTime() - fulfillmentDelayMs.SHIPPED!) },
        },
      ],
    },
    select: { id: true },
    take: 100,
  });

  for (const { id } of candidates) {
    await prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { id },
          include: { payment: true },
        });
        if (!order) return;
        const delay = fulfillmentDelayMs[order.status];
        if (delay === undefined || order.statusUpdatedAt.getTime() > now.getTime() - delay) return;

        if (order.status === OrderStatus.PAID) {
          await transitionOrder(transaction, order, OrderStatus.PROCESSING, {
            reason: 'Worker mô phỏng bắt đầu xử lý đơn.',
          });
        } else if (order.status === OrderStatus.PROCESSING) {
          await consumeOrderReservations(transaction, order.id);
          await transitionOrder(transaction, order, OrderStatus.SHIPPED, {
            reason: 'Worker mô phỏng bàn giao đơn cho vận chuyển.',
          });
          await transaction.order.update({
            where: { id: order.id },
            data: { trackingNumber: createTrackingNumber(order.orderNumber) },
          });
        } else if (order.status === OrderStatus.SHIPPED) {
          if (order.payment?.method === PaymentMethod.MOCK_COD) {
            if (order.payment.status !== PaymentStatus.PENDING) {
              throw new ConflictException('Trạng thái thanh toán COD mô phỏng không hợp lệ.');
            }
            await transaction.payment.update({
              where: { id: order.payment.id },
              data: { status: PaymentStatus.SUCCEEDED },
            });
            await transaction.paymentEvent.create({
              data: {
                paymentId: order.payment.id,
                eventId: `cod-delivered:${order.id}`,
                outcome: PaymentOutcome.SUCCESS,
              },
            });
          }
          await transitionOrder(transaction, order, OrderStatus.DELIVERED, {
            reason: 'Worker mô phỏng xác nhận giao hàng.',
          });
          if (order.pointsEarned > 0) {
            const existing = await transaction.loyaltyTransaction.findUnique({
              where: {
                orderId_type: { orderId: order.id, type: LoyaltyTransactionType.EARN },
              },
            });
            if (!existing) {
              const account = await transaction.loyaltyAccount.upsert({
                where: { userId: order.userId },
                create: { userId: order.userId, pointsBalance: order.pointsEarned },
                update: { pointsBalance: { increment: order.pointsEarned } },
              });
              await transaction.loyaltyTransaction.create({
                data: {
                  loyaltyAccountId: account.id,
                  orderId: order.id,
                  type: LoyaltyTransactionType.EARN,
                  pointsDelta: order.pointsEarned,
                },
              });
            }
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

async function sendPendingNotifications(
  prisma: PrismaClient,
  mailer: Transporter,
  config: AppConfig,
): Promise<void> {
  const history = await prisma.orderStatusHistory.findMany({
    where: { notifiedAt: null },
    include: {
      order: {
        include: {
          user: { select: { email: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  for (const entry of history) {
    const orderUrl = new URL(
      `/account/orders/${encodeURIComponent(entry.order.id)}`,
      config.WEB_ORIGIN,
    ).toString();
    await mailer.sendMail({
      from: config.MAIL_FROM,
      to: entry.order.user.email,
      subject: `Cập nhật đơn hàng ${entry.order.orderNumber}`,
      text: [
        `Chào ${entry.order.user.name},`,
        '',
        `Đơn ${entry.order.orderNumber}: ${statusLabels[entry.toStatus]}.`,
        entry.order.trackingNumber
          ? `Mã vận đơn mô phỏng: ${entry.order.trackingNumber}.`
          : undefined,
        'Đây là email mô phỏng từ Mailpit; không có giao dịch hoặc vận chuyển thật.',
        `Xem đơn hàng: ${orderUrl}`,
      ]
        .filter((line): line is string => line !== undefined)
        .join('\n'),
      headers: { 'X-Japan-Figure-Order-Status': entry.toStatus },
    });
    await prisma.orderStatusHistory.updateMany({
      where: { id: entry.id, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
  }
}

function createTrackingNumber(orderNumber: string): string {
  return `JFMOCK-${orderNumber.slice(-12).replaceAll('-', '')}`;
}
