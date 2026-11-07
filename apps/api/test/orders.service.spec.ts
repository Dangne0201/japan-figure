import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentOutcome, PaymentStatus } from '@prisma/client';
import { OrdersService } from '../src/commerce/orders.service';
import type { PrismaService } from '../src/database/prisma.service';

const pendingOrder = {
  id: 'order-1',
  userId: 'user-1',
  status: OrderStatus.PENDING_PAYMENT,
  pointsRedeemed: 100,
  payment: {
    id: 'payment-1',
    method: PaymentMethod.MOCK_TRANSFER,
    status: PaymentStatus.PENDING,
  },
};

function createService() {
  let event: { outcome: PaymentOutcome } | null = null;
  const updatedOrder = { ...pendingOrder, status: OrderStatus.PAID };
  const transaction = {
    order: {
      findFirst: jest.fn().mockResolvedValue(pendingOrder),
      findUniqueOrThrow: jest.fn().mockResolvedValue(updatedOrder),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    paymentEvent: {
      findUnique: jest.fn().mockImplementation(async () => event),
      create: jest.fn().mockImplementation(async ({ data }) => {
        event = { outcome: data.outcome };
        return event;
      }),
    },
    payment: { update: jest.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    stockReservation: {
      findMany: jest.fn().mockResolvedValue([{ variantId: 'variant-1', quantity: 2 }]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    productVariant: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    loyaltyTransaction: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    loyaltyAccount: { upsert: jest.fn().mockResolvedValue({ id: 'loyalty-1' }) },
    voucherRedemption: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  return {
    service: new OrdersService(prisma as unknown as PrismaService),
    transaction,
  };
}

describe('OrdersService payment outcomes', () => {
  it('records success once and treats a repeated event as idempotent', async () => {
    const { service, transaction } = createService();
    const input = { eventId: 'event-1', outcome: PaymentOutcome.SUCCESS };

    await service.recordPaymentOutcome('user-1', 'order-1', input);
    await service.recordPaymentOutcome('user-1', 'order-1', input);

    expect(transaction.paymentEvent.create).toHaveBeenCalledTimes(1);
    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.SUCCEEDED },
    });
    expect(transaction.orderStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('releases reserved stock, redeemed points, and voucher use after failure', async () => {
    const { service, transaction } = createService();

    await service.recordPaymentOutcome('user-1', 'order-1', {
      eventId: 'event-failed',
      outcome: PaymentOutcome.FAILURE,
    });

    expect(transaction.productVariant.updateMany).toHaveBeenCalledWith({
      where: { id: 'variant-1', stockReserved: { gte: 2 } },
      data: { stockReserved: { decrement: 2 } },
    });
    expect(transaction.loyaltyAccount.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: { userId: 'user-1', pointsBalance: 100 },
      update: { pointsBalance: { increment: 100 } },
    });
    expect(transaction.voucherRedemption.deleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
    });
  });

  it('does not disclose or update an order owned by someone else', async () => {
    const { service, transaction } = createService();
    transaction.order.findFirst.mockResolvedValue(null);

    await expect(
      service.recordPaymentOutcome('another-user', 'order-1', {
        eventId: 'event-1',
        outcome: PaymentOutcome.SUCCESS,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.payment.update).not.toHaveBeenCalled();
  });

  it('rejects reusing an event ID for a different outcome', async () => {
    const { service, transaction } = createService();
    transaction.paymentEvent.findUnique.mockResolvedValue({ outcome: PaymentOutcome.SUCCESS });

    await expect(
      service.recordPaymentOutcome('user-1', 'order-1', {
        eventId: 'event-1',
        outcome: PaymentOutcome.FAILURE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.payment.update).not.toHaveBeenCalled();
  });
});
