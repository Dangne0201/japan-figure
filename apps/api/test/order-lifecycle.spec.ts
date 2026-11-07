import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertOrderTransition } from '../src/commerce/order-lifecycle';

describe('order lifecycle', () => {
  it('allows only the documented forward transitions', () => {
    expect(() =>
      assertOrderTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID),
    ).not.toThrow();
    expect(() => assertOrderTransition(OrderStatus.PROCESSING, OrderStatus.SHIPPED)).not.toThrow();
    expect(() =>
      assertOrderTransition(OrderStatus.DELIVERED, OrderStatus.RETURN_REQUESTED),
    ).not.toThrow();
  });

  it('rejects skipping payment, moving backwards, and changing a terminal state', () => {
    expect(() => assertOrderTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.SHIPPED)).toThrow(
      ConflictException,
    );
    expect(() => assertOrderTransition(OrderStatus.SHIPPED, OrderStatus.PROCESSING)).toThrow(
      ConflictException,
    );
    expect(() => assertOrderTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toThrow(
      ConflictException,
    );
  });
});
