import Link from 'next/link';
import type { CatalogFacets, CatalogPage } from '../lib/catalog';
import ProductCard from './product-card';
import CatalogFilters, { type SelectedFilters } from './catalog-filters';

function pageHref(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set('page', String(page));
  return `/products?${next.toString()}`;
}

function filterHref(params: URLSearchParams, keys: string[]): string {
  const next = new URLSearchParams(params);
  for (const key of keys) next.delete(key);
  next.delete('page');
  const query = next.toString();
  return `/products${query ? `?${query}` : ''}`;
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
  const selectedFacet = (key: 'brand' | 'series' | 'category', value?: string) => {
    const options =
      key === 'brand' ? facets.brands : key === 'series' ? facets.series : facets.categories;
    return options.find((item) => item.slug === value)?.name;
  };
  const chips = [
    ...(selected.q ? [{ label: `Từ khóa: ${selected.q}`, keys: ['q'] }] : []),
    ...(selected.brand
      ? [
          {
            label: `Thương hiệu: ${selectedFacet('brand', selected.brand) ?? selected.brand}`,
            keys: ['brand'],
          },
        ]
      : []),
    ...(selected.series
      ? [
          {
            label: `Series: ${selectedFacet('series', selected.series) ?? selected.series}`,
            keys: ['series'],
          },
        ]
      : []),
    ...(selected.category
      ? [
          {
            label: `Dòng: ${selectedFacet('category', selected.category) ?? selected.category}`,
            keys: ['category'],
          },
        ]
      : []),
    ...(selected.scale ? [{ label: `Tỉ lệ: ${selected.scale}`, keys: ['scale'] }] : []),
    ...(selected.releaseYear
      ? [{ label: `Phát hành: ${selected.releaseYear}`, keys: ['releaseYear'] }]
      : []),
    ...(selected.minPrice || selected.maxPrice
      ? [
          {
            label: `Giá: ${selected.minPrice ? Number(selected.minPrice).toLocaleString('vi-VN') : '0'}–${selected.maxPrice ? Number(selected.maxPrice).toLocaleString('vi-VN') : 'không giới hạn'} ₫`,
            keys: ['minPrice', 'maxPrice'],
          },
        ]
      : []),
    ...(selected.availability
      ? [
          {
            label: selected.availability === 'in-stock' ? 'Còn hàng / đặt trước' : 'Tạm hết hàng',
            keys: ['availability'],
          },
        ]
      : []),
    ...(selected.preorder === 'true' ? [{ label: 'Đặt trước', keys: ['preorder'] }] : []),
    ...(selected.featured === 'true' ? [{ label: 'Nổi bật', keys: ['featured'] }] : []),
    ...(selected.newArrival === 'true' ? [{ label: 'Mới về', keys: ['newArrival'] }] : []),
    ...(selected.saleOnly === 'true' ? [{ label: 'Ưu đãi', keys: ['saleOnly'] }] : []),
  ];
  const activeCount = chips.filter((chip) => !chip.keys.includes('q')).length;
  const sortHiddenFields = Object.entries(selected).filter(
    ([key, value]) => key !== 'sort' && key !== 'page' && value,
  );
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
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <CatalogFilters facets={facets} selected={selected} activeCount={activeCount} />
          <form action="/products" className="flex min-w-0 gap-2">
            {sortHiddenFields.map(([key, value]) => (
              <input key={key} name={key} type="hidden" value={value} />
            ))}
            <label className="sr-only" htmlFor="mobile-sort">
              Sắp xếp sản phẩm
            </label>
            <select
              className="filter-control min-w-0 rounded-full"
              defaultValue={selected.sort ?? 'newest'}
              id="mobile-sort"
              name="sort"
            >
              <option value="newest">Mới nhất</option>
              <option value="price-asc">Giá tăng</option>
              <option value="price-desc">Giá giảm</option>
              <option value="name-asc">Tên A–Z</option>
            </select>
            <button
              aria-label="Áp dụng sắp xếp"
              className="button-secondary shrink-0 px-3"
              type="submit"
            >
              Áp dụng
            </button>
          </form>
        </div>
      </div>
      {chips.length ? (
        <div className="mb-5" aria-label="Bộ lọc đang áp dụng">
          <div className="flex flex-wrap gap-2">
            {chips.map(({ label, keys }) => (
              <Link
                aria-label={`Bỏ bộ lọc ${label}`}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-brand-plum/15 bg-white px-3 text-xs font-medium text-brand-ink hover:border-brand-plum"
                href={filterHref(params, keys)}
                key={`${keys.join('-')}-${label}`}
              >
                {label}
                <span aria-hidden="true" className="text-brand-plum">
                  ×
                </span>
              </Link>
            ))}
            {activeCount > 0 ? (
              <Link
                className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-brand-plum underline"
                href={filterHref(params, [
                  'brand',
                  'series',
                  'category',
                  'scale',
                  'releaseYear',
                  'minPrice',
                  'maxPrice',
                  'availability',
                  'preorder',
                  'featured',
                  'newArrival',
                  'saleOnly',
                ])}
              >
                Xóa bộ lọc
              </Link>
            ) : null}
          </div>
          <p className="sr-only" role="status">
            Đang áp dụng {activeCount} bộ lọc.
          </p>
        </div>
      ) : null}
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
