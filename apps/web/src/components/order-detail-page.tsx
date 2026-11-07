'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';
import { formatVnd } from '../lib/catalog';

interface OrderDetails {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  totalVnd: number;
  subtotalVnd: number;
  voucherDiscountVnd: number;
  loyaltyDiscountVnd: number;
  shippingFeeVnd: number;
  pointsEarned: number;
  pointsRedeemed: number;
  trackingNumber: string | null;
  paymentDeadlineAt: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  communeName: string;
  provinceName: string;
  carrierName: string;
  payment: { method: string; status: string; expiresAt: string } | null;
  items: Array<{
    id: string;
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceVnd: number;
    review: { id: string; status: string } | null;
  }>;
  statusHistory: Array<{ id: string; toStatus: string; reason: string | null; createdAt: string }>;
  returnRequest: { reason: string; status: string } | null;
}

const statusLabels: Record<string, string> = {
  SIMULATED: 'Đơn mô phỏng cũ',
  PENDING_PAYMENT: 'Chờ thanh toán mô phỏng',
  PAID: 'Đã thanh toán mô phỏng',
  PROCESSING: 'Đang chuẩn bị hàng',
  SHIPPED: 'Đang giao hàng mô phỏng',
  DELIVERED: 'Đã giao hàng mô phỏng',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Đã hết hạn thanh toán',
  RETURN_REQUESTED: 'Đã yêu cầu trả hàng',
  RETURNED: 'Đã trả hàng mô phỏng',
};

export default function OrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadOrder = useCallback(async () => {
    const response = await authenticatedFetch(`/api/orders/${encodeURIComponent(orderId)}`, {
      cache: 'no-store',
    });
    if (response.status === 401) {
      setNeedsLogin(true);
      return;
    }
    if (!response.ok) throw new Error(`Đơn hàng trả về HTTP ${response.status}.`);
    setOrder((await response.json()) as OrderDetails);
  }, [orderId]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        await loadOrder();
        if (active) setError('');
      } catch (reason) {
        console.error('Unable to load order details.', reason);
        if (active) setError('Không thể tải chi tiết đơn hàng. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [loadOrder]);

  async function submitAction(path: string, body?: object, successMessage?: string) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const requestInit: RequestInit = { method: 'POST' };
      if (body) {
        requestInit.headers = { 'Content-Type': 'application/json' };
        requestInit.body = JSON.stringify(body);
      }
      const response = await authenticatedFetch(path, requestInit);
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      }
      await response.json();
      await loadOrder();
      setMessage(successMessage ?? 'Đã cập nhật đơn hàng.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật đơn hàng.');
    } finally {
      setPending(false);
    }
  }

  async function submitReview(event: FormEvent<HTMLFormElement>, orderItemId: string) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await submitAction(
      '/api/reviews',
      {
        orderItemId,
        rating: Number(formData.get('rating')),
        body: formData.get('body'),
      },
      'Đánh giá đã gửi để chờ duyệt mô phỏng.',
    );
  }

  if (loading) return <p className="page-shell py-12">Đang tải đơn hàng…</p>;
  if (needsLogin) {
    return (
      <section className="page-shell py-12">
        <p>Đăng nhập để xem đơn hàng của bạn.</p>
        <Link className="button-primary mt-4" href="/login">
          Đăng nhập
        </Link>
      </section>
    );
  }
  if (!order) {
    return (
      <section className="page-shell py-12">
        <p className="text-red-900" role="alert">
          {error || 'Không tìm thấy đơn hàng.'}
        </p>
        <Link
          className="mt-4 inline-block font-semibold text-brand-plum underline"
          href="/account/orders"
        >
          Quay lại đơn hàng
        </Link>
      </section>
    );
  }

  return (
    <section className="page-shell py-8 sm:py-12">
      <Link className="text-sm font-semibold text-brand-plum underline" href="/account/orders">
        ← Đơn hàng của tôi
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{order.orderNumber}</h1>
          <p className="mt-2 text-sm">{statusLabels[order.status] ?? order.status}</p>
        </div>
        <button
          className="button-secondary print:hidden"
          onClick={() => window.print()}
          type="button"
        >
          In hóa đơn mô phỏng
        </button>
      </div>
      <p className="mt-3 rounded-2xl bg-brand-rose/30 p-4 text-xs leading-5">
        Đây là hóa đơn và trạng thái mô phỏng để học tập. Không phải chứng từ thuế, không có thanh
        toán, giao hàng hoặc hoàn tiền thật.
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {message}
        </p>
      ) : null}
      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <section className="rounded-3xl bg-white p-5">
            <h2 className="text-lg font-semibold">Sản phẩm</h2>
            <ul className="mt-4 divide-y divide-brand-plum/10">
              {order.items.map((item) => (
                <li className="py-4 first:pt-0 last:pb-0" key={item.id}>
                  <div className="flex justify-between gap-4 text-sm">
                    <span>
                      <strong>{item.productName}</strong>
                      <span className="block text-xs text-brand-ink/60">
                        {item.variantName} · {item.quantity} sản phẩm
                      </span>
                    </span>
                    <span>{formatVnd(item.unitPriceVnd * item.quantity)}</span>
                  </div>
                  {order.status === 'DELIVERED' && !item.review ? (
                    <form
                      className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr_auto]"
                      onSubmit={(event) => void submitReview(event, item.id)}
                    >
                      <label className="filter-label">
                        Điểm
                        <select className="filter-control" name="rating">
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>
                              {rating} sao
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="filter-label">
                        Đánh giá
                        <input
                          className="filter-control"
                          maxLength={2000}
                          name="body"
                          placeholder="Chia sẻ cảm nhận"
                          required
                        />
                      </label>
                      <button
                        className="button-secondary self-end"
                        disabled={pending}
                        type="submit"
                      >
                        Gửi
                      </button>
                    </form>
                  ) : item.review ? (
                    <p className="mt-2 text-xs text-brand-ink/60">
                      Đánh giá: {item.review.status === 'APPROVED' ? 'đã duyệt' : 'đang chờ duyệt'}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-3xl bg-white p-5">
            <h2 className="text-lg font-semibold">Lịch sử trạng thái</h2>
            <ol className="mt-4 space-y-3">
              {order.statusHistory.map((entry) => (
                <li className="border-l-2 border-brand-plum/20 pl-3 text-sm" key={entry.id}>
                  <strong>{statusLabels[entry.toStatus] ?? entry.toStatus}</strong>
                  <span className="ml-2 text-xs text-brand-ink/55">
                    {new Date(entry.createdAt).toLocaleString('vi-VN')}
                  </span>
                  {entry.reason ? (
                    <p className="mt-1 text-xs text-brand-ink/65">{entry.reason}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-3xl bg-white p-5">
            <h2 className="text-lg font-semibold">Tóm tắt mô phỏng</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Tiền hàng</dt>
                <dd>{formatVnd(order.subtotalVnd)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Ưu đãi</dt>
                <dd>-{formatVnd(order.voucherDiscountVnd)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Điểm đã dùng</dt>
                <dd>-{formatVnd(order.loyaltyDiscountVnd)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Giao hàng</dt>
                <dd>{formatVnd(order.shippingFeeVnd)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-brand-plum/10 pt-3 font-bold">
                <dt>Tổng</dt>
                <dd>{formatVnd(order.totalVnd)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-brand-ink/65">
              {order.payment
                ? `${order.payment.method === 'MOCK_COD' ? 'COD mô phỏng' : 'Chuyển khoản mô phỏng'} · ${order.payment.status}`
                : 'Đơn hàng mô phỏng cũ'}
            </p>
            {order.trackingNumber ? (
              <p className="mt-2 text-sm">
                Mã vận đơn mô phỏng: <strong>{order.trackingNumber}</strong>
              </p>
            ) : null}
            <p className="mt-2 text-xs text-brand-ink/65">
              Người nhận: {order.recipientName} · {order.phone}
              <br />
              {order.streetAddress}, {order.communeName}, {order.provinceName}
              <br />
              {order.carrierName}
            </p>
            {order.status === 'PENDING_PAYMENT' && order.payment?.method === 'MOCK_TRANSFER' ? (
              <div className="mt-4 space-y-2 print:hidden">
                <p className="text-xs text-brand-ink/65">
                  Hạn thanh toán mô phỏng:{' '}
                  {new Date(order.paymentDeadlineAt).toLocaleString('vi-VN')}
                </p>
                <button
                  className="button-primary w-full"
                  disabled={pending}
                  onClick={() =>
                    void submitAction(
                      `/api/orders/${encodeURIComponent(order.id)}/payment-outcome`,
                      { eventId: `demo-success-${order.id}`, outcome: 'SUCCESS' },
                      'Đã ghi nhận thanh toán mô phỏng thành công.',
                    )
                  }
                  type="button"
                >
                  Mô phỏng thanh toán thành công
                </button>
                <button
                  className="button-secondary w-full"
                  disabled={pending}
                  onClick={() =>
                    void submitAction(
                      `/api/orders/${encodeURIComponent(order.id)}/payment-outcome`,
                      { eventId: `demo-failure-${order.id}`, outcome: 'FAILURE' },
                      'Đã ghi nhận thanh toán mô phỏng thất bại.',
                    )
                  }
                  type="button"
                >
                  Mô phỏng thất bại
                </button>
                <button
                  className="button-secondary w-full"
                  disabled={pending}
                  onClick={() =>
                    void submitAction(
                      `/api/orders/${encodeURIComponent(order.id)}/payment-outcome`,
                      { eventId: `demo-cancel-${order.id}`, outcome: 'CANCEL' },
                      'Đã hủy thanh toán mô phỏng.',
                    )
                  }
                  type="button"
                >
                  Hủy thanh toán
                </button>
              </div>
            ) : null}
            {(order.status === 'PENDING_PAYMENT' ||
              (order.status === 'PROCESSING' && order.payment?.method === 'MOCK_COD')) && (
              <button
                className="button-secondary mt-3 w-full print:hidden"
                disabled={pending}
                onClick={() =>
                  void submitAction(
                    `/api/orders/${encodeURIComponent(order.id)}/cancel`,
                    undefined,
                    'Đơn hàng mô phỏng đã được hủy.',
                  )
                }
                type="button"
              >
                Hủy đơn mô phỏng
              </button>
            )}
          </section>
          {order.status === 'DELIVERED' && !order.returnRequest ? (
            <form
              className="rounded-3xl bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                const formData = new FormData(event.currentTarget);
                void submitAction(
                  `/api/orders/${encodeURIComponent(order.id)}/return`,
                  { reason: formData.get('reason') },
                  'Yêu cầu trả hàng mô phỏng đã được ghi nhận; không có khoản hoàn tiền thật.',
                );
              }}
            >
              <h2 className="text-lg font-semibold">Yêu cầu trả hàng mô phỏng</h2>
              <label className="filter-label mt-3">
                Lý do
                <textarea
                  className="filter-control min-h-24"
                  maxLength={500}
                  name="reason"
                  required
                />
              </label>
              <button className="button-secondary mt-3 w-full" disabled={pending} type="submit">
                Gửi yêu cầu
              </button>
            </form>
          ) : order.returnRequest ? (
            <p className="rounded-3xl bg-white p-5 text-sm">
              Yêu cầu trả hàng: {order.returnRequest.reason} · {order.returnRequest.status}. Không
              phát sinh hoàn tiền thật.
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
