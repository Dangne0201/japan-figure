'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { authenticatedFetch } from '../lib/api';
import { formatVnd, productImageUrl } from '../lib/catalog';

interface WishlistItem {
  id: string;
  product: {
    slug: string;
    name: string;
    characterName: string;
    priceVnd: number;
    salePriceVnd: number | null;
    images: Array<{ url: string; altText: string }>;
  };
}

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [pendingSlug, setPendingSlug] = useState('');

  async function load() {
    const response = await authenticatedFetch('/api/wishlist', { cache: 'no-store' });
    if (response.status === 401) {
      setNeedsLogin(true);
      return;
    }
    if (!response.ok) throw new Error(`Wishlist trả về HTTP ${response.status}.`);
    setItems((await response.json()) as WishlistItem[]);
  }

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      try {
        await load();
      } catch (reason) {
        console.error('Unable to load wishlist.', reason);
        if (active) setError('Không thể tải danh sách yêu thích.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void initialLoad();
    return () => {
      active = false;
    };
  }, []);

  async function remove(productSlug: string) {
    setPendingSlug(productSlug);
    setError('');
    try {
      const response = await authenticatedFetch(
        `/api/wishlist/${encodeURIComponent(productSlug)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error(`Không thể xóa sản phẩm (HTTP ${response.status}).`);
      await response.json();
      setItems((current) => current.filter((item) => item.product.slug !== productSlug));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật danh sách.');
    } finally {
      setPendingSlug('');
    }
  }

  return (
    <section className="page-shell py-8 sm:py-12">
      <h1 className="text-3xl font-semibold">Danh sách yêu thích</h1>
      {loading ? <p className="mt-5">Đang tải danh sách…</p> : null}
      {error ? (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {needsLogin ? (
        <div className="mt-5 rounded-3xl bg-white p-6">
          <p>Đăng nhập để xem danh sách yêu thích.</p>
          <Link className="button-primary mt-4" href="/login">
            Đăng nhập
          </Link>
        </div>
      ) : null}
      {!loading && !needsLogin && !items.length ? (
        <p className="mt-5 rounded-2xl bg-white p-6">Danh sách yêu thích đang trống.</p>
      ) : null}
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(({ id, product }) => (
          <li className="rounded-3xl bg-white p-3" key={id}>
            <Link href={`/products/${product.slug}`}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-brand-rose/20">
                <Image
                  alt={product.images[0]?.altText ?? `Hình minh họa ${product.name}`}
                  className="object-cover"
                  fill
                  sizes="(max-width: 640px) 45vw, 25vw"
                  src={productImageUrl(product.slug)}
                  unoptimized
                />
              </div>
              <h2 className="mt-3 line-clamp-2 text-sm font-semibold">{product.name}</h2>
            </Link>
            <p className="mt-2 text-sm font-bold">
              {formatVnd(product.salePriceVnd ?? product.priceVnd)}
            </p>
            <button
              className="button-secondary mt-3 w-full"
              disabled={pendingSlug === product.slug}
              onClick={() => void remove(product.slug)}
              type="button"
            >
              {pendingSlug === product.slug ? 'Đang xóa…' : 'Bỏ khỏi danh sách'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
