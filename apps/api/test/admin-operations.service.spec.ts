import { ConflictException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ReturnStatus,
} from '../src/generated/prisma/client';
import { AdminOperationsService } from '../src/admin/admin-operations.service';
import type { PrismaService } from '../src/database/prisma.service';

function makeCancelOrderHarness() {
  const order = {
    id: 'order-1',
    status: OrderStatus.PENDING_PAYMENT,
    userId: 'customer-1',
    pointsRedeemed: 0,
    payment: {
      id: 'payment-1',
      method: PaymentMethod.MOCK_TRANSFER,
      status: PaymentStatus.PENDING,
    },
  };
  const transaction = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ ...order, status: OrderStatus.CANCELLED }),
    },
    payment: { update: jest.fn().mockResolvedValue({}) },
    orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    stockReservation: { findMany: jest.fn().mockResolvedValue([]) },
    voucherRedemption: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  return {
    service: new AdminOperationsService(prisma as unknown as PrismaService, {
      enqueueProduct: jest.fn().mockResolvedValue(undefined),
    }),
    transaction,
    order,
  };
}

describe('AdminOperationsService', () => {
  it('cancels eligible orders and releases commitments inside one transaction', async () => {
    const { service, transaction } = makeCancelOrderHarness();

    const order = await service.cancelOrder('admin-1', 'order-1', 'Yêu cầu của khách.');

    expect(order.status).toBe(OrderStatus.CANCELLED);
    expect(transaction.payment.update).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.CANCELLED },
    });
    expect(transaction.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: OrderStatus.PENDING_PAYMENT },
      data: expect.objectContaining({ status: OrderStatus.CANCELLED }),
    });
    expect(transaction.voucherRedemption.deleteMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
    });
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'ORDER_CANCELLED',
        entityId: 'order-1',
      }),
    });
  });

  it('rejects cancellation for an order outside the cancellable states', async () => {
    const { service, transaction, order } = makeCancelOrderHarness();
    transaction.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.SHIPPED });

    await expect(service.cancelOrder('admin-1', 'order-1', 'Không còn phù hợp.')).rejects.toThrow(
      ConflictException,
    );
    expect(transaction.payment.update).not.toHaveBeenCalled();
    expect(transaction.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it('marks a rejected return request resolved and preserves its delivery deadline', async () => {
    const returnRequest = { id: 'return-1', status: ReturnStatus.REQUESTED };
    const order = {
      id: 'order-1',
      status: OrderStatus.RETURN_REQUESTED,
      deliveredAt: new Date('2026-11-01T10:00:00Z'),
      returnRequest,
    };
    const transaction = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ ...order, status: OrderStatus.DELIVERED }),
      },
      returnRequest: { update: jest.fn().mockResolvedValue({}) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      adminAuditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new AdminOperationsService(prisma as unknown as PrismaService, {
      enqueueProduct: jest.fn().mockResolvedValue(undefined),
    });

    await service.resolveReturn('admin-1', 'order-1', 'REJECTED', 'Không đủ điều kiện.');

    expect(transaction.returnRequest.update).toHaveBeenCalledWith({
      where: { id: 'return-1' },
      data: { status: ReturnStatus.REJECTED, completedAt: expect.any(Date) },
    });
    expect(transaction.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ deliveredAt: expect.anything() }),
      }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'RETURN_REJECTED' }),
    });
  });
});
