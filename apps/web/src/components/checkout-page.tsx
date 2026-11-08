'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatVnd } from '../lib/catalog';
import { authenticatedFetch } from '../lib/api';

interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  provinceName: string;
  communeName: string;
  communeType: string;
  isDefault: boolean;
}

interface ShippingOption {
  carrierId: string;
  carrierName: string;
  feeVnd: number;
  estimatedDeliveryFrom: string;
  estimatedDeliveryTo: string;
  freeShippingApplied: boolean;
}

interface Quote {
  address: Address;
  lines: Array<{ productName: string; quantity: number; unitPriceVnd: number }>;
  shipping: ShippingOption;
  shippingOptions: ShippingOption[];
  amounts: {
    subtotalVnd: number;
    voucherDiscountVnd: number;
    loyaltyDiscountVnd: number;
    shippingFeeVnd: number;
    totalVnd: number;
    pointsEarned: number;
    pointsRedeemed: number;
  };
  voucherCode: string | null;
  loyaltyPointsAvailable: number;
  freeShippingThresholdVnd: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [carrierId, setCarrierId] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'MOCK_TRANSFER' | 'MOCK_COD'>('MOCK_TRANSFER');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAddresses() {
      try {
        const response = await authenticatedFetch('/api/addresses', { cache: 'no-store' });
        if (response.status === 401) {
          setNeedsLogin(true);
          return;
        }
        if (!response.ok) throw new Error(`Địa chỉ trả về HTTP ${response.status}.`);
        const result = (await response.json()) as Address[];
        setAddresses(result);
        setAddressId(result.find((address) => address.isDefault)?.id ?? result[0]?.id ?? '');
      } catch (reason) {
        console.error('Unable to load checkout addresses.', reason);
        setError('Không thể tải địa chỉ nhận hàng. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    }
    void loadAddresses();
  }, []);

  async function calculateQuote(nextCarrierId = carrierId) {
    if (!addressId) {
      setError('Hãy thêm địa chỉ nhận hàng trước khi tiếp tục.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/checkout/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId,
          ...(nextCarrierId ? { carrierId: nextCarrierId } : {}),
          ...(voucherCode.trim() ? { voucherCode: voucherCode.trim() } : {}),
          redeemPoints,
          paymentMethod,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      }
      const result = (await response.json()) as Quote;
      setQuote(result);
      setCarrierId(result.shipping.carrierId);
    } catch (reason) {
      setQuote(null);
      setError(reason instanceof Error ? reason.message : 'Không thể tính tổng đơn hàng.');
    } finally {
      setPending(false);
    }
  }

  async function placeOrder() {
    if (!quote) return;
    setPending(true);
    setError('');
    try {
      const response = await authenticatedFetch('/api/checkout/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addressId,
          carrierId,
          ...(voucherCode.trim() ? { voucherCode: voucherCode.trim() } : {}),
          redeemPoints,
          paymentMethod,
        }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      }
      const result = (await response.json()) as { id: string };
      router.push(`/account/orders/${encodeURIComponent(result.id)}`);
    } catch (reason) {
      setQuote(null);
      setError(reason instanceof Error ? reason.message : 'Không thể ghi nhận đơn hàng mô phỏng.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <p className="page-shell py-12">Đang tải thông tin đặt hàng…</p>;
  if (needsLogin) {
    return (
      <section className="page-shell py-12">
        <div className="rounded-3xl bg-white p-7">
          <h1 className="text-2xl font-semibold">Đăng nhập để đặt hàng</h1>
          <p className="mt-3 text-sm text-brand-ink/70">
            Giỏ hàng khách sẽ được gộp sau khi đăng nhập.
          </p>
          <Link className="button-primary mt-5" href="/login?next=%2Fcheckout">
            Đăng nhập
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">Đặt hàng mô phỏng</h1>
      <p className="mt-2 text-sm text-brand-ink/70">
        Không thanh toán thật. Phí giao hàng và hãng vận chuyển đều là dữ liệu mô phỏng.
      </p>
      {error ? (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {addresses.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-6">
          <p>Bạn cần có địa chỉ nhận hàng trước khi đặt.</p>
          <Link className="button-primary mt-4" href="/account/addresses">
            Thêm địa chỉ
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <section className="rounded-3xl bg-white p-5">
              <h2 className="text-lg font-semibold">Địa chỉ nhận hàng</h2>
              <label className="filter-label mt-4">
                Chọn địa chỉ
                <select
                  className="filter-control"
                  onChange={(event) => {
                    setAddressId(event.target.value);
                    setQuote(null);
                  }}
                  value={addressId}
                >
                  {addresses.map((address) => (
                    <option key={address.id} value={address.id}>
                      {address.label} · {address.recipientName} · {address.communeName},{' '}
                      {address.provinceName}
                    </option>
                  ))}
                </select>
              </label>
              <Link
                className="mt-3 inline-block text-sm font-semibold text-brand-plum underline"
                href="/account/addresses"
              >
                Quản lý sổ địa chỉ
              </Link>
            </section>
            <section className="rounded-3xl bg-white p-5">
              <h2 className="text-lg font-semibold">Ưu đãi và điểm</h2>
              <label className="filter-label mt-4">
                Mã ưu đãi
                <input
                  autoCapitalize="characters"
                  className="filter-control"
                  maxLength={40}
                  onChange={(event) => {
                    setVoucherCode(event.target.value.toUpperCase());
                    setQuote(null);
                  }}
                  placeholder="Ví dụ: FIGURE10 hoặc FREESHIP"
                  value={voucherCode}
                />
              </label>
              <label className="filter-label mt-4">
                Điểm muốn dùng
                <input
                  className="filter-control"
                  min={0}
                  onChange={(event) => {
                    setRedeemPoints(Number(event.target.value));
                    setQuote(null);
                  }}
                  type="number"
                  value={redeemPoints}
                />
              </label>
              <p className="mt-2 text-xs text-brand-ink/60">
                100 điểm = 10.000 ₫; không thể dùng điểm vượt quá giá trị hàng hóa sau ưu đãi.
              </p>
            </section>
            <section className="rounded-3xl bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Vận chuyển</h2>
                <button
                  className="button-secondary"
                  disabled={pending}
                  onClick={() => void calculateQuote()}
                  type="button"
                >
                  {pending ? 'Đang tính…' : 'Tính phí và ưu đãi'}
                </button>
              </div>
              {quote ? (
                <div className="mt-4 space-y-3">
                  {quote.shippingOptions.map((option) => (
                    <label
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-plum/10 p-4 text-sm"
                      key={option.carrierId}
                    >
                      <input
                        checked={carrierId === option.carrierId}
                        name="carrier"
                        onChange={() => {
                          setCarrierId(option.carrierId);
                          void calculateQuote(option.carrierId);
                        }}
                        type="radio"
                      />
                      <span className="flex-1">
                        <span className="block font-semibold">{option.carrierName}</span>
                        <span className="mt-1 block text-xs text-brand-ink/60">
                          Dự kiến {option.estimatedDeliveryFrom} – {option.estimatedDeliveryTo}
                        </span>
                      </span>
                      <strong>{option.feeVnd === 0 ? 'Miễn phí' : formatVnd(option.feeVnd)}</strong>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-brand-ink/60">
                  Tính phí để xem các lựa chọn vận chuyển mô phỏng.
                </p>
              )}
            </section>
          </div>
          <aside className="rounded-3xl bg-white p-5">
            <h2 className="text-lg font-semibold">Tóm tắt đơn hàng</h2>
            {quote ? (
              <>
                <fieldset className="mt-4 space-y-3">
                  <legend className="text-sm font-semibold">Thanh toán mô phỏng</legend>
                  <label className="flex items-start gap-3 rounded-2xl border border-brand-plum/10 p-3 text-sm">
                    <input
                      checked={paymentMethod === 'MOCK_TRANSFER'}
                      name="payment-method"
                      onChange={() => setPaymentMethod('MOCK_TRANSFER')}
                      type="radio"
                    />
                    <span>
                      <span className="block font-semibold">Chuyển khoản mô phỏng</span>
                      <span className="text-xs text-brand-ink/60">
                        Chọn kết quả thành công, thất bại hoặc hủy ở trang đơn hàng.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-2xl border border-brand-plum/10 p-3 text-sm">
                    <input
                      checked={paymentMethod === 'MOCK_COD'}
                      name="payment-method"
                      onChange={() => setPaymentMethod('MOCK_COD')}
                      type="radio"
                    />
                    <span>
                      <span className="block font-semibold">
                        Thanh toán khi nhận hàng (COD mô phỏng)
                      </span>
                      <span className="text-xs text-brand-ink/60">
                        Worker sẽ tự mô phỏng giao hàng; không thu tiền thật.
                      </span>
                    </span>
                  </label>
                </fieldset>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt>Tiền hàng</dt>
                    <dd>{formatVnd(quote.amounts.subtotalVnd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Ưu đãi</dt>
                    <dd>-{formatVnd(quote.amounts.voucherDiscountVnd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Điểm đã dùng</dt>
                    <dd>-{formatVnd(quote.amounts.loyaltyDiscountVnd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Giao hàng ({quote.shipping.carrierName})</dt>
                    <dd>{formatVnd(quote.amounts.shippingFeeVnd)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-brand-plum/10 pt-3 text-base font-bold">
                    <dt>Tổng mô phỏng</dt>
                    <dd>{formatVnd(quote.amounts.totalVnd)}</dd>
                  </div>
                </dl>
                <p className="mt-4 text-xs text-brand-ink/60">
                  Số điểm hiện có: {quote.loyaltyPointsAvailable.toLocaleString('vi-VN')} · Ước tính
                  nhận thêm: {quote.amounts.pointsEarned.toLocaleString('vi-VN')}
                </p>
                <button
                  className="button-primary mt-5 w-full"
                  disabled={pending}
                  onClick={() => void placeOrder()}
                  type="button"
                >
                  {pending ? 'Đang ghi nhận…' : 'Xác nhận đơn mô phỏng'}
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-brand-ink/60">
                Chọn địa chỉ và tính đơn để xem tổng tiền.
              </p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
