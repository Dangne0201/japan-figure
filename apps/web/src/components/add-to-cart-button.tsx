'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authenticatedFetch } from '../lib/api';

export default function AddToCartButton({
  variantId,
  disabled,
  compact = false,
  showQuantity = false,
  maxQuantity = 99,
  buyNow = false,
}: {
  variantId?: string | undefined;
  disabled?: boolean;
  compact?: boolean;
  showQuantity?: boolean;
  maxQuantity?: number;
  buyNow?: boolean;
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function add(goToCheckout = false) {
    if (!variantId) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/cart/items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, quantity }),
      });
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        setError(
          Array.isArray(result.message)
            ? result.message.join(' ')
            : (result.message ?? 'Không thể thêm sản phẩm.'),
        );
        return;
      }
      if (goToCheckout) {
        router.push('/checkout');
        return;
      }
      setMessage('Đã thêm vào giỏ hàng.');
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {showQuantity && !disabled && variantId ? (
        <div className="mt-5 flex items-center gap-3">
          <label className="text-sm font-semibold" htmlFor="product-quantity">
            Số lượng
          </label>
          <div className="flex items-center rounded-full border border-brand-plum/20 bg-white">
            <button
              aria-label="Giảm số lượng"
              className="size-11 rounded-l-full font-semibold"
              disabled={quantity <= 1 || pending}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              type="button"
            >
              −
            </button>
            <input
              className="w-12 bg-transparent text-center text-sm font-semibold outline-none"
              id="product-quantity"
              inputMode="numeric"
              max={maxQuantity}
              min={1}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (Number.isInteger(next)) setQuantity(Math.min(maxQuantity, Math.max(1, next)));
              }}
              type="number"
              value={quantity}
            />
            <button
              aria-label="Tăng số lượng"
              className="size-11 rounded-r-full font-semibold"
              disabled={quantity >= maxQuantity || pending}
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              type="button"
            >
              +
            </button>
          </div>
          <span className="text-xs text-brand-ink/60">Tối đa {maxQuantity}</span>
        </div>
      ) : null}
      <div className={buyNow ? 'mt-3 flex flex-col gap-2 sm:flex-row' : ''}>
        <button
          className={
            compact
              ? 'button-secondary mt-3 w-full'
              : buyNow
                ? 'button-primary w-full sm:w-auto'
                : 'button-primary mt-5 w-full sm:w-auto'
          }
          disabled={disabled || !variantId || pending}
          onClick={() => void add()}
          type="button"
        >
          {pending ? 'Đang thêm…' : disabled || !variantId ? 'Tạm hết hàng' : 'Thêm vào giỏ'}
        </button>
        {buyNow ? (
          <button
            className="button-secondary w-full sm:w-auto"
            disabled={disabled || !variantId || pending}
            onClick={() => void add(true)}
            type="button"
          >
            Mua ngay
          </button>
        ) : null}
      </div>
      {message ? (
        <p className="mt-2 text-sm text-emerald-900" role="status">
          {message}{' '}
          <Link className="font-semibold underline" href="/cart">
            Xem giỏ
          </Link>
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
