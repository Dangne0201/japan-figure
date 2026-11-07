export interface ProductCard {
  slug: string;
  name: string;
  characterName: string;
  description: string;
  priceVnd: number;
  salePriceVnd: number | null;
  scale: string | null;
  material: string;
  releaseDate: string | null;
  janCode: string;
  isPreorder: boolean;
  preorderDepositVnd: number | null;
  isFeatured: boolean;
  isNewArrival: boolean;
  stock: number;
  availability: 'in-stock' | 'sold-out';
  brand: { slug: string; name: string };
  series: { slug: string; name: string };
  categories: Array<{ slug: string; name: string }>;
  images: Array<{ url: string; altText: string }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    stockAvailable: number;
    weightGrams: number;
  }>;
}

export interface CatalogFacets {
  brands: Array<{ slug: string; name: string }>;
  series: Array<{ slug: string; name: string }>;
  categories: Array<{ slug: string; name: string }>;
  scales: string[];
}

export interface CatalogPage {
  items: ProductCard[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface CatalogHome {
  featured: ProductCard[];
  newArrivals: ProductCard[];
  preorders: ProductCard[];
  sales: ProductCard[];
}

const apiBase = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(new URL(path, apiBase), {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Catalog API returned HTTP ${response.status}`);
  return (await response.json()) as T;
}

export async function getCatalogHome(): Promise<CatalogHome> {
  return getJson('/api/catalog/home');
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  return getJson('/api/catalog/facets');
}

export async function getCatalogPage(params: URLSearchParams): Promise<CatalogPage> {
  const search = params.toString();
  return getJson(`/api/catalog/products${search ? `?${search}` : ''}`);
}

export async function getProduct(slug: string): Promise<{
  product: ProductCard;
  related: ProductCard[];
  reviews: Array<{ rating: number; body: string; createdAt: string; user: { name: string } }>;
  averageRating: number | null;
}> {
  return getJson(`/api/catalog/products/${encodeURIComponent(slug)}`);
}

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

export function productImageUrl(slug: string): string {
  return `/catalog-assets/${encodeURIComponent(slug)}`;
}
