import type { Metadata } from 'next';
import { getCatalogFacets, getCatalogPage } from '../../lib/catalog';
import type { CatalogFacets, CatalogPage } from '../../lib/catalog';
import CatalogListing from '../../components/catalog-listing';
import type { SelectedFilters } from '../../components/catalog-filters';
import SiteFooter from '../../components/site-footer';
import SiteHeader from '../../components/site-header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Danh mục figure | Japan Figure',
  description: 'Tìm figure anime theo series, thương hiệu, dòng sản phẩm và mức giá.',
};

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function makeSearchParams(values: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
  }
  return params;
}

function selectedFilters(values: SearchParams): SelectedFilters {
  return Object.fromEntries(
    [
      'q',
      'brand',
      'series',
      'category',
      'scale',
      'minPrice',
      'maxPrice',
      'availability',
      'preorder',
      'saleOnly',
      'sort',
    ]
      .map((key) => [key, firstValue(values[key])])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const values = await searchParams;
  const params = makeSearchParams(values);
  let facets: CatalogFacets | null = null;
  let result: CatalogPage | null = null;
  let unavailable = false;

  try {
    [facets, result] = await Promise.all([getCatalogFacets(), getCatalogPage(params)]);
  } catch (error) {
    console.error('Unable to load catalog listing.', error);
    unavailable = true;
  }

  return (
    <main className="min-h-screen bg-brand-cream">
      <SiteHeader initialQuery={firstValue(values.q) ?? ''} />
      {unavailable || !facets || !result ? (
        <section className="page-shell py-16" role="alert">
          <h1 className="text-3xl font-semibold">Danh mục chưa tải được</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-brand-ink/70">
            Không thể kết nối catalog. Hãy kiểm tra API/database đang hoạt động rồi tải lại trang.
          </p>
        </section>
      ) : (
        <CatalogListing
          facets={facets}
          result={result}
          params={params}
          selected={selectedFilters(values)}
        />
      )}
      <SiteFooter />
    </main>
  );
}
