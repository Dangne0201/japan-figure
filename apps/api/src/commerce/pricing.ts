export type VoucherKind = 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';

export interface VoucherTerms {
  type: VoucherKind;
  value: number;
  maxDiscountVnd: number | null;
}

export interface ShippingOption {
  carrierId: string;
  carrierName: string;
  feeVnd: number;
  estimatedDeliveryFrom: string;
  estimatedDeliveryTo: string;
  freeShippingApplied: boolean;
}

export interface CheckoutAmounts {
  subtotalVnd: number;
  voucherDiscountVnd: number;
  loyaltyDiscountVnd: number;
  shippingFeeVnd: number;
  totalVnd: number;
  pointsEarned: number;
  pointsRedeemed: number;
}

const FREE_SHIPPING_THRESHOLD_VND = 1_500_000;
export const LOYALTY_POINT_VALUE_VND = 100;
export const LOYALTY_EARN_RATE_VND = 10_000;

const regions: Record<string, 'north' | 'central' | 'south'> = {
  '01': 'north',
  '04': 'north',
  '08': 'north',
  '11': 'north',
  '12': 'north',
  '14': 'north',
  '15': 'north',
  '19': 'north',
  '20': 'north',
  '22': 'north',
  '24': 'north',
  '25': 'north',
  '31': 'north',
  '33': 'north',
  '37': 'north',
  '38': 'central',
  '40': 'central',
  '42': 'central',
  '44': 'central',
  '46': 'central',
  '48': 'central',
  '51': 'central',
  '52': 'central',
  '56': 'central',
  '66': 'central',
  '68': 'central',
  '75': 'south',
  '79': 'south',
  '80': 'south',
  '82': 'south',
  '86': 'south',
  '91': 'south',
  '92': 'south',
  '96': 'south',
};

const rates = {
  north: [
    {
      carrierId: 'mock-ghn',
      carrierName: 'GHN (mô phỏng)',
      base: 26_000,
      step: 4_000,
      minDays: 1,
      maxDays: 2,
    },
    {
      carrierId: 'mock-ghtk',
      carrierName: 'GHTK (mô phỏng)',
      base: 24_000,
      step: 5_000,
      minDays: 2,
      maxDays: 3,
    },
    {
      carrierId: 'mock-viettel-post',
      carrierName: 'Viettel Post (mô phỏng)',
      base: 28_000,
      step: 4_000,
      minDays: 2,
      maxDays: 3,
    },
  ],
  central: [
    {
      carrierId: 'mock-ghn',
      carrierName: 'GHN (mô phỏng)',
      base: 32_000,
      step: 6_000,
      minDays: 2,
      maxDays: 3,
    },
    {
      carrierId: 'mock-ghtk',
      carrierName: 'GHTK (mô phỏng)',
      base: 30_000,
      step: 6_000,
      minDays: 3,
      maxDays: 4,
    },
    {
      carrierId: 'mock-viettel-post',
      carrierName: 'Viettel Post (mô phỏng)',
      base: 34_000,
      step: 5_000,
      minDays: 2,
      maxDays: 4,
    },
  ],
  south: [
    {
      carrierId: 'mock-ghn',
      carrierName: 'GHN (mô phỏng)',
      base: 25_000,
      step: 4_000,
      minDays: 1,
      maxDays: 2,
    },
    {
      carrierId: 'mock-ghtk',
      carrierName: 'GHTK (mô phỏng)',
      base: 23_000,
      step: 5_000,
      minDays: 2,
      maxDays: 3,
    },
    {
      carrierId: 'mock-viettel-post',
      carrierName: 'Viettel Post (mô phỏng)',
      base: 27_000,
      step: 4_000,
      minDays: 2,
      maxDays: 3,
    },
  ],
} as const;

export function calculateVoucherDiscount(subtotalVnd: number, voucher?: VoucherTerms): number {
  assertNonNegativeInteger(subtotalVnd, 'subtotalVnd');
  if (!voucher) return 0;
  assertNonNegativeInteger(voucher.value, 'voucher.value');
  if (voucher.maxDiscountVnd !== null) {
    assertNonNegativeInteger(voucher.maxDiscountVnd, 'voucher.maxDiscountVnd');
  }
  let discount: number;
  switch (voucher.type) {
    case 'PERCENT':
      if (voucher.value < 1 || voucher.value > 100)
        throw new RangeError('Percentage must be 1–100.');
      discount = Math.floor((subtotalVnd * voucher.value) / 100);
      break;
    case 'FIXED':
      discount = Math.min(subtotalVnd, voucher.value);
      break;
    case 'FREE_SHIPPING':
      return 0;
  }
  return voucher.maxDiscountVnd === null ? discount : Math.min(discount, voucher.maxDiscountVnd);
}

export function calculateShippingOptions(
  provinceCode: string,
  weightGrams: number,
  discountedSubtotalVnd: number,
  freeShippingVoucher: boolean,
  today = new Date(),
): ShippingOption[] {
  assertNonNegativeInteger(weightGrams, 'weightGrams');
  assertNonNegativeInteger(discountedSubtotalVnd, 'discountedSubtotalVnd');
  if (weightGrams < 1) throw new RangeError('Package weight must be positive.');
  if (weightGrams > 30_000) throw new RangeError('Package exceeds the 30 kg demo limit.');
  const region = regions[provinceCode];
  if (!region) throw new RangeError('Unknown province code.');
  const isFree = freeShippingVoucher || discountedSubtotalVnd >= FREE_SHIPPING_THRESHOLD_VND;
  const extraBands = Math.max(0, Math.ceil((weightGrams - 1_000) / 500));

  return rates[region].map((rate) => ({
    carrierId: rate.carrierId,
    carrierName: rate.carrierName,
    feeVnd: isFree ? 0 : rate.base + extraBands * rate.step,
    estimatedDeliveryFrom: addCalendarDays(today, rate.minDays),
    estimatedDeliveryTo: addCalendarDays(today, rate.maxDays),
    freeShippingApplied: isFree,
  }));
}

export function calculateLoyaltyDiscount(
  requestedPoints: number,
  availablePoints: number,
  eligibleSubtotalVnd: number,
): { pointsRedeemed: number; discountVnd: number } {
  assertNonNegativeInteger(requestedPoints, 'requestedPoints');
  assertNonNegativeInteger(availablePoints, 'availablePoints');
  assertNonNegativeInteger(eligibleSubtotalVnd, 'eligibleSubtotalVnd');
  const maxRedeemable = Math.min(
    availablePoints,
    Math.floor(eligibleSubtotalVnd / LOYALTY_POINT_VALUE_VND),
  );
  if (requestedPoints > maxRedeemable) {
    throw new RangeError(`At most ${maxRedeemable} points can be redeemed.`);
  }
  return {
    pointsRedeemed: requestedPoints,
    discountVnd: requestedPoints * LOYALTY_POINT_VALUE_VND,
  };
}

export function calculateEarnedPoints(eligibleSubtotalVnd: number): number {
  assertNonNegativeInteger(eligibleSubtotalVnd, 'eligibleSubtotalVnd');
  return Math.floor(eligibleSubtotalVnd / LOYALTY_EARN_RATE_VND);
}

export function calculateCheckoutAmounts(input: {
  subtotalVnd: number;
  voucherDiscountVnd: number;
  loyaltyDiscountVnd: number;
  shippingFeeVnd: number;
  pointsRedeemed: number;
}): CheckoutAmounts {
  const { subtotalVnd, voucherDiscountVnd, loyaltyDiscountVnd, shippingFeeVnd } = input;
  for (const [name, value] of Object.entries(input)) assertNonNegativeInteger(value, name);
  if (voucherDiscountVnd + loyaltyDiscountVnd > subtotalVnd) {
    throw new RangeError('Discounts cannot exceed the merchandise subtotal.');
  }
  const eligibleSubtotalVnd = subtotalVnd - voucherDiscountVnd - loyaltyDiscountVnd;
  return {
    ...input,
    totalVnd: eligibleSubtotalVnd + shippingFeeVnd,
    pointsEarned: calculateEarnedPoints(eligibleSubtotalVnd),
  };
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer.`);
  }
}

function addCalendarDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
