'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authenticatedFetch } from '../lib/api';

export default function AddToCartButton({
  variantId,
  disabled,
  compact = false,
}: {
  variantId?: string | undefined;
  disabled?: boolean;
  compact?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function add() {
    if (!variantId) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await authenticatedFetch('/api/cart/items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId, quantity: 1 }),
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
      setMessage('Đã thêm vào giỏ hàng.');
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        className={
          compact ? 'button-secondary mt-3 w-full' : 'button-primary mt-5 w-full sm:w-auto'
        }
        disabled={disabled || !variantId || pending}
        onClick={() => void add()}
        type="button"
      >
        {pending ? 'Đang thêm…' : disabled || !variantId ? 'Tạm hết hàng' : 'Thêm vào giỏ'}
      </button>
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
