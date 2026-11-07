import Link from 'next/link';
import type { CatalogFacets, CatalogPage } from '../lib/catalog';
import ProductCard from './product-card';
import CatalogFilters, { type SelectedFilters } from './catalog-filters';

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set('page', String(page));
  return `/products?${next.toString()}`;
}

export default function CatalogListing({
  facets,
  result,
  params,
  selected,
}: {
  facets: CatalogFacets;
  result: CatalogPage;
  params: URLSearchParams;
  selected: SelectedFilters;
}) {
  const { pagination } = result;
  return (
    <div className="page-shell py-8 sm:py-12">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-plum">
          Bộ sưu tập
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
          {selected.q ? `Kết quả cho “${selected.q}”` : 'Khám phá figure'}
        </h1>
        <p className="mt-2 text-sm text-brand-ink/65">
          {pagination.total} sản phẩm · Giá và tồn kho là dữ liệu mô phỏng phục vụ học tập.
        </p>
      </div>
      <div className="mb-4 sm:hidden">
        <CatalogFilters facets={facets} selected={selected} />
      </div>
      <div className="grid gap-6 sm:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="hidden sm:block">
          <CatalogFilters facets={facets} selected={selected} />
        </div>
        <section aria-label="Danh sách sản phẩm">
          {result.items.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {result.items.map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          ) : (
            <div
              className="rounded-3xl border border-dashed border-brand-plum/25 bg-white/70 px-6 py-14 text-center"
              role="status"
            >
              <p className="text-4xl" aria-hidden="true">
                ⌕
              </p>
              <h2 className="mt-3 text-xl font-semibold">Chưa tìm thấy sản phẩm phù hợp</h2>
              <p className="mt-2 text-sm text-brand-ink/65">
                Thử đổi từ khóa hoặc xóa bớt bộ lọc nhé.
              </p>
              <Link className="button-primary mt-5" href="/products">
                Xem toàn bộ sản phẩm
              </Link>
            </div>
          )}
          {pagination.pages > 1 && (
            <nav
              className="mt-9 flex items-center justify-center gap-2"
              aria-label="Phân trang sản phẩm"
            >
              {pagination.page > 1 && (
                <Link className="button-secondary" href={pageHref(params, pagination.page - 1)}>
                  Trước
                </Link>
              )}
              <span className="px-3 text-sm" aria-current="page">
                Trang {pagination.page} / {pagination.pages}
              </span>
              {pagination.page < pagination.pages && (
                <Link className="button-secondary" href={pageHref(params, pagination.page + 1)}>
                  Tiếp
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
