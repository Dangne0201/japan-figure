'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../lib/api';
import { formatVnd } from '../lib/catalog';

interface OrderRow {
  id: string;
  orderNumber: string;
  status: string;
  totalVnd: number;
  createdAt: string;
  payment: { method: string; status: string } | null;
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await authenticatedFetch('/api/orders', { cache: 'no-store' });
        if (response.status === 401) {
          if (active) setNeedsLogin(true);
          return;
        }
        if (!response.ok) throw new Error(`Đơn hàng trả về HTTP ${response.status}.`);
        const result = (await response.json()) as OrderRow[];
        if (active) setOrders(result);
      } catch (reason) {
        console.error('Unable to load customer orders.', reason);
        if (active) setError('Không thể tải đơn hàng. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
      <section className="page-shell py-8 sm:py-12">
        <h1 className="text-3xl font-semibold">Đơn hàng của tôi</h1>
        <p className="mt-2 text-sm text-brand-ink/70">
          Theo dõi đơn và các bước thanh toán, vận chuyển đều là mô phỏng.
        </p>
        {loading ? <p className="mt-6">Đang tải đơn hàng…</p> : null}
        {error ? (
          <p className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}
        {needsLogin ? (
          <div className="mt-6 rounded-3xl bg-white p-6">
            <p>Đăng nhập để xem đơn hàng của bạn.</p>
            <Link className="button-primary mt-4" href="/login">
              Đăng nhập
            </Link>
          </div>
        ) : null}
        {!loading && !error && !needsLogin && orders.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-white p-6">
            <p>Bạn chưa có đơn hàng nào.</p>
            <Link className="button-primary mt-4" href="/products">
              Khám phá figure
            </Link>
          </div>
        ) : null}
        <ul className="mt-6 space-y-4">
          {orders.map((order) => (
            <li className="rounded-3xl bg-white p-5 sm:p-6" key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-brand-ink/60">
                    {new Date(order.createdAt).toLocaleString('vi-VN')}
                  </p>
                  <h2 className="mt-1 font-semibold">{order.orderNumber}</h2>
                  <p className="mt-2 text-sm">{statusLabels[order.status] ?? order.status}</p>
                </div>
                <strong>{formatVnd(order.totalVnd)}</strong>
              </div>
              <Link
                className="mt-4 inline-flex font-semibold text-brand-plum underline"
                href={`/account/orders/${encodeURIComponent(order.id)}`}
              >
                Xem chi tiết
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
