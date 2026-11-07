'use client';

import { useEffect, useState } from 'react';
import type { CatalogFacets } from '../lib/catalog';

export type SelectedFilters = Record<string, string | undefined>;

export default function CatalogFilters({
  facets,
  selected,
}: {
  facets: CatalogFacets;
  selected: SelectedFilters;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const form = (
    <form action="/products" className="space-y-4" onSubmit={() => setOpen(false)}>
      {selected.q && <input type="hidden" name="q" value={selected.q} />}
      <label className="filter-label">
        Series
        <select className="filter-control" name="series" defaultValue={selected.series ?? ''}>
          <option value="">Tất cả series</option>
          {facets.series.map((series) => (
            <option key={series.slug} value={series.slug}>
              {series.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-label">
        Thương hiệu
        <select className="filter-control" name="brand" defaultValue={selected.brand ?? ''}>
          <option value="">Tất cả thương hiệu</option>
          {facets.brands.map((brand) => (
            <option key={brand.slug} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-label">
        Dòng figure
        <select className="filter-control" name="category" defaultValue={selected.category ?? ''}>
          <option value="">Tất cả dòng</option>
          {facets.categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-label">
        Tỉ lệ / kích thước
        <select className="filter-control" name="scale" defaultValue={selected.scale ?? ''}>
          <option value="">Mọi kích thước</option>
          {facets.scales.map((scale) => (
            <option key={scale} value={scale}>
              {scale}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold">Khoảng giá (₫)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor="minimum-price">
            Giá từ
          </label>
          <input
            id="minimum-price"
            className="filter-control"
            name="minPrice"
            type="number"
            min="0"
            step="50000"
            placeholder="Từ"
            defaultValue={selected.minPrice}
          />
          <label className="sr-only" htmlFor="maximum-price">
            Giá đến
          </label>
          <input
            id="maximum-price"
            className="filter-control"
            name="maxPrice"
            type="number"
            min="0"
            step="50000"
            placeholder="Đến"
            defaultValue={selected.maxPrice}
          />
        </div>
      </fieldset>
      <label className="filter-label">
        Tình trạng
        <select
          className="filter-control"
          name="availability"
          defaultValue={selected.availability ?? ''}
        >
          <option value="">Tất cả</option>
          <option value="in-stock">Còn hàng / đặt trước</option>
          <option value="sold-out">Tạm hết hàng</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          className="size-4 accent-brand-plum"
          name="preorder"
          type="checkbox"
          value="true"
          defaultChecked={selected.preorder === 'true'}
        />
        Chỉ xem hàng đặt trước
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          className="size-4 accent-brand-plum"
          name="saleOnly"
          type="checkbox"
          value="true"
          defaultChecked={selected.saleOnly === 'true'}
        />
        Chỉ xem sản phẩm ưu đãi
      </label>
      <label className="filter-label">
        Sắp xếp
        <select className="filter-control" name="sort" defaultValue={selected.sort ?? 'newest'}>
          <option value="newest">Mới cập nhật</option>
          <option value="price-asc">Giá tăng dần</option>
          <option value="price-desc">Giá giảm dần</option>
          <option value="name-asc">Tên A–Z</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2 pt-2">
        <a
          className="button-secondary"
          href={selected.q ? `/products?q=${encodeURIComponent(selected.q)}` : '/products'}
          onClick={() => setOpen(false)}
        >
          Xóa lọc
        </a>
        <button className="button-primary" type="submit">
          Áp dụng
        </button>
      </div>
    </form>
  );

  return (
    <>
      <button
        className="button-secondary w-full sm:hidden"
        type="button"
        onClick={() => setOpen(true)}
      >
        Lọc và sắp xếp
      </button>
      <aside
        className="hidden rounded-3xl border border-brand-plum/10 bg-white p-5 sm:block"
        aria-label="Bộ lọc sản phẩm"
      >
        <h2 className="mb-4 text-lg font-semibold">Bộ lọc</h2>
        {form}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden" role="presentation">
          <button
            className="absolute inset-0 bg-brand-ink/45"
            onClick={() => setOpen(false)}
            aria-label="Đóng bộ lọc"
          />
          <section
            className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl bg-brand-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-soft"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-title"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="mobile-filter-title" className="text-lg font-semibold">
                Lọc sản phẩm
              </h2>
              <button
                className="grid size-10 place-items-center rounded-full bg-white text-xl"
                onClick={() => setOpen(false)}
                aria-label="Đóng bộ lọc"
              >
                ×
              </button>
            </div>
            {form}
          </section>
        </div>
      )}
    </>
  );
}
