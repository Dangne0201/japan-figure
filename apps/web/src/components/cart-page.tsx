'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { formatVnd } from '../lib/catalog';
import { authenticatedFetch } from '../lib/api';

interface CartLine {
  variantId: string;
  sku: string;
  variantName: string;
  productSlug: string;
  productName: string;
  image: string;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
  stockAvailable: number;
  exceedsStock: boolean;
  isAvailable: boolean;
}

interface CartState {
  items: CartLine[];
  itemCount: number;
  subtotalVnd: number;
}

export default function CartPage() {
  const [cart, setCart] = useState<CartState | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState('');
  const [error, setError] = useState('');

  async function loadCart() {
    setError('');
    try {
      const response = await authenticatedFetch('/api/cart', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Giỏ hàng trả về HTTP ${response.status}.`);
      setCart((await response.json()) as CartState);
    } catch (reason) {
      console.error('Unable to load the cart.', reason);
      setError('Không thể tải giỏ hàng. Hãy kiểm tra API/Redis rồi thử lại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCart();
  }, []);

  async function changeItem(variantId: string, method: 'PUT' | 'DELETE', quantity?: number) {
    setPendingId(variantId);
    setError('');
    try {
      const response = await authenticatedFetch(
        `/api/cart/items/${encodeURIComponent(variantId)}`,
        {
          method,
          ...(method === 'PUT'
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity }),
              }
            : {}),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      }
      setCart((await response.json()) as CartState);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật giỏ hàng.');
    } finally {
      setPendingId('');
    }
  }

  return (
    <section className="page-shell py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">Giỏ hàng</h1>
      {error ? (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="mt-6 rounded-2xl bg-white p-6">Đang tải giỏ hàng…</p> : null}
      {!loading && cart?.items.length === 0 ? (
        <div className="mt-6 rounded-3xl bg-white p-8 text-center">
          <p>Giỏ hàng đang trống.</p>
          <Link className="button-primary mt-5" href="/products">
            Khám phá figure
          </Link>
        </div>
      ) : null}
      {!loading && cart && cart.items.length > 0 ? (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <ul className="space-y-4">
            {cart.items.map((item) => (
              <li
                className="grid grid-cols-[76px_1fr] gap-4 rounded-3xl bg-white p-4 sm:grid-cols-[96px_1fr_auto]"
                key={item.variantId}
              >
                {item.productSlug ? (
                  <Link
                    className="relative aspect-[4/5] overflow-hidden rounded-xl bg-brand-rose/20"
                    href={`/products/${item.productSlug}`}
                  >
                    <Image
                      alt={`Hình minh họa ${item.productName}`}
                      className="object-cover"
                      fill
                      sizes="96px"
                      src={`/catalog-assets/${encodeURIComponent(item.productSlug)}`}
                      unoptimized
                    />
                  </Link>
                ) : (
                  <div
                    aria-label="Sản phẩm không còn trong danh mục"
                    className="flex aspect-[4/5] items-center justify-center rounded-xl bg-brand-rose/20 text-xs"
                    role="img"
                  >
                    Không còn
                  </div>
                )}
                <div className="min-w-0">
                  {item.productSlug ? (
                    <Link
                      className="font-semibold hover:text-brand-plum"
                      href={`/products/${item.productSlug}`}
                    >
                      {item.productName}
                    </Link>
                  ) : (
                    <span className="font-semibold">{item.productName}</span>
                  )}
                  <p className="mt-1 text-xs text-brand-ink/60">
                    {item.variantName} · {item.sku}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{formatVnd(item.unitPriceVnd)}</p>
                  {!item.isAvailable || item.exceedsStock ? (
                    <p className="mt-2 text-xs text-red-800" role="alert">
                      {!item.isAvailable
                        ? 'Sản phẩm không còn được bán. Hãy xóa sản phẩm để tiếp tục.'
                        : `Chỉ còn ${item.stockAvailable} sản phẩm. Hãy giảm số lượng hoặc xóa sản phẩm.`}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs">
                      Số lượng
                      <input
                        aria-label={`Số lượng ${item.productName}`}
                        className="filter-control w-20"
                        disabled={
                          pendingId === item.variantId ||
                          !item.isAvailable ||
                          item.stockAvailable < 1
                        }
                        max={Math.max(1, Math.min(99, item.stockAvailable))}
                        min={1}
                        onChange={(event) => {
                          const value = Number(event.currentTarget.value);
                          if (Number.isInteger(value) && value >= 1 && value <= 99) {
                            void changeItem(item.variantId, 'PUT', value);
                          }
                        }}
                        type="number"
                        value={item.quantity}
                      />
                    </label>
                    <button
                      className="text-xs font-semibold text-brand-plum underline"
                      disabled={pendingId === item.variantId}
                      onClick={() => void changeItem(item.variantId, 'DELETE')}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
                <p className="col-span-2 text-right text-sm font-bold sm:col-span-1">
                  {formatVnd(item.lineTotalVnd)}
                </p>
              </li>
            ))}
          </ul>
          <aside className="rounded-3xl bg-white p-5">
            <h2 className="text-lg font-semibold">Tạm tính</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span>{cart.itemCount} sản phẩm</span>
              <strong>{formatVnd(cart.subtotalVnd)}</strong>
            </div>
            <p className="mt-4 text-xs leading-5 text-brand-ink/60">
              Phí vận chuyển và ưu đãi sẽ được tính ở bước đặt hàng mô phỏng. Chưa phát sinh giao
              dịch thật.
            </p>
            {cart.items.some((item) => !item.isAvailable || item.exceedsStock) ? (
              <button className="button-primary mt-5 w-full opacity-50" disabled type="button">
                Điều chỉnh giỏ hàng để tiếp tục
              </button>
            ) : (
              <Link className="button-primary mt-5 w-full" href="/checkout">
                Tiếp tục đặt hàng
              </Link>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
