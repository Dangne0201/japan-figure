import {
  calculateCheckoutAmounts,
  calculateEarnedPoints,
  calculateLoyaltyDiscount,
  calculateShippingOptions,
  calculateVoucherDiscount,
} from '../src/commerce/pricing';

describe('commerce pricing', () => {
  it('rounds percentage discounts down to whole VND and respects the cap', () => {
    expect(
      calculateVoucherDiscount(1_234_567, {
        type: 'PERCENT',
        value: 15,
        maxDiscountVnd: 100_000,
      }),
    ).toBe(100_000);
    expect(
      calculateVoucherDiscount(999, { type: 'PERCENT', value: 10, maxDiscountVnd: null }),
    ).toBe(99);
  });

  it('does not let a fixed voucher discount more than the subtotal', () => {
    expect(
      calculateVoucherDiscount(50_000, { type: 'FIXED', value: 100_000, maxDiscountVnd: null }),
    ).toBe(50_000);
  });

  it('calculates shipping by province region and package weight', () => {
    const north = calculateShippingOptions(
      '01',
      1_000,
      500_000,
      false,
      new Date('2026-11-07T00:00:00Z'),
    );
    const south = calculateShippingOptions(
      '79',
      1_500,
      500_000,
      false,
      new Date('2026-11-07T00:00:00Z'),
    );
    expect(north.at(0)?.feeVnd).toBe(26_000);
    expect(south.at(0)?.feeVnd).toBe(29_000);
    expect(north.at(0)?.estimatedDeliveryFrom).toBe('2026-11-08');
  });

  it('applies the free-shipping threshold or a free-shipping voucher', () => {
    expect(calculateShippingOptions('01', 2_000, 1_500_000, false).at(0)?.feeVnd).toBe(0);
    expect(calculateShippingOptions('01', 2_000, 100_000, true).at(0)?.feeVnd).toBe(0);
  });

  it('limits points to both the account balance and discounted item subtotal', () => {
    expect(calculateLoyaltyDiscount(100, 500, 50_000)).toEqual({
      pointsRedeemed: 100,
      discountVnd: 10_000,
    });
    expect(() => calculateLoyaltyDiscount(501, 500, 100_000)).toThrow(RangeError);
  });

  it('earns points only on discounted merchandise, excluding shipping', () => {
    expect(calculateEarnedPoints(99_999)).toBe(9);
    expect(
      calculateCheckoutAmounts({
        subtotalVnd: 100_000,
        voucherDiscountVnd: 10_000,
        loyaltyDiscountVnd: 10_000,
        shippingFeeVnd: 30_000,
        pointsRedeemed: 100,
      }),
    ).toMatchObject({ totalVnd: 110_000, pointsEarned: 8 });
  });
});
