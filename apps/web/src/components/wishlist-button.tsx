'use client';

import Link from 'next/link';
import { useState } from 'react';
import { authenticatedFetch } from '../lib/api';

export default function WishlistButton({ productSlug }: { productSlug: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [loginRequired, setLoginRequired] = useState(false);

  async function add() {
    setPending(true);
    setMessage('');
    setLoginRequired(false);
    try {
      const response = await authenticatedFetch('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productSlug }),
      });
      if (response.status === 401) {
        setLoginRequired(true);
        return;
      }
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      }
      await response.json();
      setMessage('Đã lưu');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Không thể lưu sản phẩm.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        className="w-full rounded-xl border border-brand-plum/20 px-3 py-2 text-xs font-semibold text-brand-plum hover:bg-brand-rose/20 disabled:opacity-60"
        disabled={pending}
        onClick={() => void add()}
        type="button"
      >
        {pending ? 'Đang lưu…' : '♡ Danh sách yêu thích'}
      </button>
      {message ? <p className="mt-1 text-center text-xs text-brand-ink/70">{message}</p> : null}
      {loginRequired ? (
        <p className="mt-1 text-center text-xs">
          <Link className="font-semibold text-brand-plum underline" href="/login">
            Đăng nhập để lưu
          </Link>
        </p>
      ) : null}
    </div>
  );
}
