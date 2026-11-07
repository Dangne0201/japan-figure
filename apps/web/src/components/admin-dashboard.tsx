'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';
import { formatVnd } from '../lib/catalog';
import AdminOperationsPanel from './admin-operations-panel';

interface AdminUser {
  id: string;
  name: string;
  role: string;
}

interface DashboardCounts {
  products: number;
  publishedProducts: number;
  orders: number;
  activeOrders: number;
  customers: number;
  pendingReviews: number;
}

interface CatalogOption {
  id: string;
  name: string;
}

interface ProductOptionGroups {
  brands: CatalogOption[];
  series: CatalogOption[];
  categories: CatalogOption[];
}

interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  stockOnHand: number;
  stockReserved: number;
  weightGrams: number;
}

interface AdminProduct {
  id: string;
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
  publishedAt: string | null;
  brandId: string;
  seriesId: string;
  brand: CatalogOption;
  series: CatalogOption;
  categories: Array<{ category: CatalogOption }>;
  variants: ProductVariant[];
}

interface AdminProductForm {
  slug: string;
  name: string;
  characterName: string;
  description: string;
  priceVnd: string;
  salePriceVnd: string;
  scale: string;
  material: string;
  releaseDate: string;
  janCode: string;
  isPreorder: boolean;
  preorderDepositVnd: string;
  isFeatured: boolean;
  isNewArrival: boolean;
  published: boolean;
  brandId: string;
  seriesId: string;
  categoryIds: string[];
  sku: string;
  variantName: string;
  weightGrams: string;
  stockOnHand: string;
}

const emptyForm = (): AdminProductForm => ({
  slug: '',
  name: '',
  characterName: '',
  description: '',
  priceVnd: '',
  salePriceVnd: '',
  scale: '',
  material: 'PVC, ABS',
  releaseDate: '',
  janCode: '',
  isPreorder: false,
  preorderDepositVnd: '',
  isFeatured: false,
  isNewArrival: false,
  published: false,
  brandId: '',
  seriesId: '',
  categoryIds: [],
  sku: '',
  variantName: 'Phiên bản tiêu chuẩn',
  weightGrams: '1000',
  stockOnHand: '0',
});

class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  if (!response.ok) {
    let message = `Yêu cầu trả về HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? message);
    } catch (error) {
      console.error('Unable to read the admin API error response.', error);
    }
    throw new AdminApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export default function AdminDashboard() {
  const [access, setAccess] = useState<'loading' | 'guest' | 'forbidden' | 'admin' | 'error'>(
    'loading',
  );
  const [user, setUser] = useState<AdminUser | null>(null);
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [options, setOptions] = useState<ProductOptionGroups | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<AdminProductForm>(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async (nextPage: number, nextQuery: string) => {
    const [nextCounts, nextOptions, productResult] = await Promise.all([
      requestJson<DashboardCounts>('/api/admin/dashboard'),
      requestJson<ProductOptionGroups>('/api/admin/catalog-options'),
      requestJson<{ items: AdminProduct[]; pagination: { pages: number } }>(
        `/api/admin/products?page=${nextPage}&limit=12${nextQuery ? `&q=${encodeURIComponent(nextQuery)}` : ''}`,
      ),
    ]);
    setCounts(nextCounts);
    setOptions(nextOptions);
    setProducts(productResult.items);
    setPages(Math.max(1, productResult.pagination.pages));
    setPage(nextPage);
    setQuery(nextQuery);
    setStockInputs(
      Object.fromEntries(
        productResult.items.flatMap((product) =>
          product.variants.map((variant) => [variant.id, String(variant.stockOnHand)]),
        ),
      ),
    );
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const session = await requestJson<AdminUser>('/api/auth/me');
        if (!active) return;
        setUser(session);
        if (session.role !== 'ADMIN') {
          setAccess('forbidden');
          return;
        }
        await loadData(1, '');
        if (active) setAccess('admin');
      } catch (reason) {
        if (!active) return;
        if (reason instanceof AdminApiError && reason.status === 401) {
          setAccess('guest');
        } else {
          console.error('Unable to load admin dashboard.', reason);
          setError(reason instanceof Error ? reason.message : 'Không thể tải trang quản trị.');
          setAccess('error');
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [loadData]);

  function updateForm<K extends keyof AdminProductForm>(key: K, value: AdminProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startCreate() {
    const fresh = emptyForm();
    fresh.brandId = options?.brands[0]?.id ?? '';
    fresh.seriesId = options?.series[0]?.id ?? '';
    fresh.categoryIds = options?.categories[0] ? [options.categories[0].id] : [];
    setEditing(null);
    setForm(fresh);
    setImage(null);
    setError('');
    setMessage('');
  }

  function startEdit(product: AdminProduct) {
    setEditing(product);
    setForm({
      slug: product.slug,
      name: product.name,
      characterName: product.characterName,
      description: product.description,
      priceVnd: String(product.priceVnd),
      salePriceVnd: product.salePriceVnd === null ? '' : String(product.salePriceVnd),
      scale: product.scale ?? '',
      material: product.material,
      releaseDate: product.releaseDate?.slice(0, 10) ?? '',
      janCode: product.janCode,
      isPreorder: product.isPreorder,
      preorderDepositVnd:
        product.preorderDepositVnd === null ? '' : String(product.preorderDepositVnd),
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
      published: product.publishedAt !== null,
      brandId: product.brandId,
      seriesId: product.seriesId,
      categoryIds: product.categories.map(({ category }) => category.id),
      sku: '',
      variantName: '',
      weightGrams: '1000',
      stockOnHand: '0',
    });
    setImage(null);
    setError('');
    setMessage('');
    document.getElementById('admin-product-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function refresh(nextPage = page, nextQuery = query) {
    setPending(true);
    setError('');
    try {
      await loadData(nextPage, nextQuery);
    } catch (reason) {
      console.error('Unable to refresh admin data.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu quản trị.');
    } finally {
      setPending(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        slug: form.slug,
        name: form.name,
        characterName: form.characterName,
        description: form.description,
        priceVnd: Number(form.priceVnd),
        salePriceVnd: form.salePriceVnd ? Number(form.salePriceVnd) : null,
        scale: form.scale || null,
        material: form.material,
        releaseDate: form.releaseDate || null,
        janCode: form.janCode,
        isPreorder: form.isPreorder,
        preorderDepositVnd: form.preorderDepositVnd ? Number(form.preorderDepositVnd) : null,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        published: form.published,
        brandId: form.brandId,
        seriesId: form.seriesId,
        categoryIds: form.categoryIds,
      };
      const product = editing
        ? await requestJson<AdminProduct>(`/api/admin/products/${encodeURIComponent(editing.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await requestJson<AdminProduct>('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              sku: form.sku,
              variantName: form.variantName,
              weightGrams: Number(form.weightGrams),
              stockOnHand: Number(form.stockOnHand),
            }),
          });
      if (image) {
        const formData = new FormData();
        formData.append('image', image);
        await requestJson(`/api/admin/products/${encodeURIComponent(product.id)}/image`, {
          method: 'POST',
          body: formData,
        });
      }
      setMessage(editing ? 'Đã cập nhật sản phẩm.' : 'Đã tạo sản phẩm.');
      setEditing(product);
      await loadData(page, query);
    } catch (reason) {
      console.error('Unable to save admin product.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể lưu sản phẩm.');
    } finally {
      setPending(false);
    }
  }

  async function setStock(product: AdminProduct, variant: ProductVariant) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await requestJson(
        `/api/admin/products/${encodeURIComponent(product.id)}/variants/${encodeURIComponent(variant.id)}/stock`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stockOnHand: Number(stockInputs[variant.id]) }),
        },
      );
      setMessage(`Đã cập nhật tồn kho ${variant.sku}.`);
      await loadData(page, query);
    } catch (reason) {
      console.error('Unable to update product stock.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật tồn kho.');
    } finally {
      setPending(false);
    }
  }

  if (access === 'loading') {
    return <main className="page-shell py-12">Đang kiểm tra quyền quản trị…</main>;
  }
  if (access === 'guest') {
    return (
      <main className="page-shell py-12">
        <h1 className="text-2xl font-semibold">Đăng nhập để quản trị</h1>
        <Link className="button-primary mt-4 inline-flex" href="/login">
          Đăng nhập
        </Link>
      </main>
    );
  }
  if (access === 'forbidden') {
    return (
      <main className="page-shell py-12">
        <h1 className="text-2xl font-semibold">Tài khoản không có quyền quản trị</h1>
        <p className="mt-2 text-sm text-brand-ink/70">Khu vực này chỉ dành cho tài khoản ADMIN.</p>
        <Link className="button-secondary mt-4 inline-flex" href="/">
          Về cửa hàng
        </Link>
      </main>
    );
  }
  if (access === 'error') {
    return (
      <main className="page-shell py-12">
        <h1 className="text-2xl font-semibold">Không tải được trang quản trị</h1>
        <p className="mt-3 text-red-900" role="alert">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-cream">
      <section className="page-shell py-8 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-brand-plum">Quản trị mô phỏng</p>
            <h1 className="mt-1 text-3xl font-semibold">Xin chào, {user?.name}</h1>
            <p className="mt-2 text-sm text-brand-ink/70">
              Thay đổi chỉ áp dụng cho dữ liệu cửa hàng local.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="button-secondary" href="#admin-operations-title">
              Đơn hàng &amp; vận hành
            </Link>
            <Link className="button-secondary" href="/">
              Về cửa hàng
            </Link>
          </div>
        </div>

        {error ? (
          <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            {message}
          </p>
        ) : null}

        {counts ? (
          <section aria-label="Tổng quan" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
            {[
              ['Sản phẩm', counts.products],
              ['Đang bán', counts.publishedProducts],
              ['Đơn hàng', counts.orders],
              ['Đơn đang xử lý', counts.activeOrders],
              ['Khách hàng', counts.customers],
              ['Đánh giá chờ duyệt', counts.pendingReviews],
            ].map(([label, value]) => (
              <article className="rounded-2xl bg-white p-4" key={label}>
                <p className="text-xs text-brand-ink/65">{label}</p>
                <strong className="mt-2 block text-2xl">{value}</strong>
              </article>
            ))}
          </section>
        ) : null}

        <section className="mt-8" id="admin-products">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold">Sản phẩm và tồn kho</h2>
              <p className="mt-1 text-sm text-brand-ink/65">
                Tồn kho khả dụng luôn trừ số lượng đã được giữ cho đơn hàng.
              </p>
            </div>
            <button className="button-primary" onClick={startCreate} type="button">
              Thêm sản phẩm
            </button>
          </div>

          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void refresh(1, searchInput.trim());
            }}
          >
            <label className="sr-only" htmlFor="admin-product-search">
              Tìm sản phẩm
            </label>
            <input
              className="filter-control flex-1"
              id="admin-product-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên, slug hoặc mã JAN"
              value={searchInput}
            />
            <button className="button-secondary" disabled={pending} type="submit">
              Tìm
            </button>
            <button
              className="button-secondary"
              disabled={pending || page <= 1}
              onClick={() => void refresh(page - 1)}
              type="button"
            >
              Trang trước
            </button>
            <button
              className="button-secondary"
              disabled={pending || page >= pages}
              onClick={() => void refresh(page + 1)}
              type="button"
            >
              Trang sau
            </button>
          </form>

          <ul className="mt-4 grid gap-4 xl:grid-cols-2">
            {products.map((product) => (
              <li className="rounded-3xl bg-white p-5" key={product.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-brand-ink/60">{product.slug}</p>
                    <h3 className="mt-1 font-semibold">{product.name}</h3>
                    <p className="mt-1 text-sm text-brand-ink/70">
                      {product.series.name} · {product.brand.name}
                    </p>
                  </div>
                  <span className="badge">{product.publishedAt ? 'Đang bán' : 'Bản nháp'}</span>
                </div>
                <p className="mt-3 text-sm font-semibold">
                  {formatVnd(product.salePriceVnd ?? product.priceVnd)}
                  {product.salePriceVnd ? (
                    <span className="ml-2 text-xs font-normal text-brand-ink/55 line-through">
                      {formatVnd(product.priceVnd)}
                    </span>
                  ) : null}
                </p>
                <button
                  className="mt-3 text-sm font-semibold text-brand-plum underline"
                  disabled={pending}
                  onClick={() => startEdit(product)}
                  type="button"
                >
                  Chỉnh sửa
                </button>
                <ul className="mt-3 space-y-3 border-t border-brand-plum/10 pt-3">
                  {product.variants.map((variant) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 text-sm"
                      key={variant.id}
                    >
                      <span>
                        <strong>{variant.sku}</strong> · {variant.name}
                        <span className="block text-xs text-brand-ink/60">
                          Khả dụng {variant.stockOnHand - variant.stockReserved} / Đang giữ{' '}
                          {variant.stockReserved}
                        </span>
                      </span>
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void setStock(product, variant);
                        }}
                      >
                        <label className="sr-only" htmlFor={`stock-${variant.id}`}>
                          Tồn kho {variant.sku}
                        </label>
                        <input
                          className="filter-control w-24"
                          id={`stock-${variant.id}`}
                          max={1_000_000}
                          min={variant.stockReserved}
                          onChange={(event) =>
                            setStockInputs((current) => ({
                              ...current,
                              [variant.id]: event.target.value,
                            }))
                          }
                          type="number"
                          value={stockInputs[variant.id] ?? variant.stockOnHand}
                        />
                        <button className="button-secondary" disabled={pending} type="submit">
                          Lưu kho
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {!products.length ? (
            <p className="mt-4 rounded-2xl bg-white p-5 text-sm">Không tìm thấy sản phẩm.</p>
          ) : null}
        </section>

        {options ? (
          <section className="mt-8 rounded-3xl bg-white p-5 sm:p-7" id="admin-product-form">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold">
                  {editing ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm'}
                </h2>
                <p className="mt-1 text-sm text-brand-ink/65">
                  Giá lưu bằng VND nguyên; sản phẩm mới mặc định là bản nháp.
                </p>
              </div>
              <button className="button-secondary" onClick={startCreate} type="button">
                Làm mới biểu mẫu
              </button>
            </div>
            <form
              className="mt-5 grid gap-4 sm:grid-cols-2"
              onSubmit={(event) => void saveProduct(event)}
            >
              <TextField
                label="Tên sản phẩm"
                maxLength={240}
                onChange={(v) => updateForm('name', v)}
                required
                value={form.name}
              />
              <TextField
                label="Tên nhân vật"
                maxLength={160}
                onChange={(v) => updateForm('characterName', v)}
                required
                value={form.characterName}
              />
              <TextField
                label="Slug"
                maxLength={180}
                onChange={(v) => updateForm('slug', v.toLowerCase())}
                required
                value={form.slug}
              />
              <TextField
                label="Mã JAN / mã sản phẩm"
                maxLength={20}
                onChange={(v) => updateForm('janCode', v)}
                required
                value={form.janCode}
              />
              <TextField
                label="Giá niêm yết (₫)"
                min="1"
                onChange={(v) => updateForm('priceVnd', v)}
                required
                type="number"
                value={form.priceVnd}
              />
              <TextField
                label="Giá ưu đãi (₫)"
                min="1"
                onChange={(v) => updateForm('salePriceVnd', v)}
                type="number"
                value={form.salePriceVnd}
              />
              <TextField
                label="Tỷ lệ (ví dụ 1/7)"
                maxLength={30}
                onChange={(v) => updateForm('scale', v)}
                value={form.scale}
              />
              <TextField
                label="Chất liệu"
                maxLength={100}
                onChange={(v) => updateForm('material', v)}
                required
                value={form.material}
              />
              <TextField
                label="Ngày phát hành"
                onChange={(v) => updateForm('releaseDate', v)}
                type="date"
                value={form.releaseDate}
              />
              <TextField
                label="Tiền cọc đặt trước (₫)"
                min="1"
                onChange={(v) => updateForm('preorderDepositVnd', v)}
                type="number"
                value={form.preorderDepositVnd}
              />
              <SelectField
                label="Hãng"
                onChange={(v) => updateForm('brandId', v)}
                options={options.brands}
                value={form.brandId}
              />
              <SelectField
                label="Series"
                onChange={(v) => updateForm('seriesId', v)}
                options={options.series}
                value={form.seriesId}
              />
              <label className="filter-label sm:col-span-2">
                Mô tả
                <textarea
                  className="filter-control min-h-28"
                  maxLength={10_000}
                  onChange={(event) => updateForm('description', event.target.value)}
                  required
                  value={form.description}
                />
              </label>
              <label className="filter-label sm:col-span-2">
                Thể loại
                <select
                  className="filter-control min-h-28"
                  multiple
                  onChange={(event) =>
                    updateForm(
                      'categoryIds',
                      Array.from(event.currentTarget.selectedOptions, (option) => option.value),
                    )
                  }
                  value={form.categoryIds}
                >
                  {options.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1 text-xs text-brand-ink/55">
                  Trên máy tính có thể giữ Ctrl để chọn nhiều thể loại.
                </span>
              </label>

              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                <CheckField
                  checked={form.isPreorder}
                  label="Sản phẩm đặt trước"
                  onChange={(v) => updateForm('isPreorder', v)}
                />
                <CheckField
                  checked={form.isFeatured}
                  label="Hiển thị nổi bật"
                  onChange={(v) => updateForm('isFeatured', v)}
                />
                <CheckField
                  checked={form.isNewArrival}
                  label="Hàng mới về"
                  onChange={(v) => updateForm('isNewArrival', v)}
                />
                <CheckField
                  checked={form.published}
                  label="Đưa sản phẩm lên cửa hàng"
                  onChange={(v) => updateForm('published', v)}
                />
              </div>

              {!editing ? (
                <>
                  <TextField
                    label="SKU phiên bản đầu tiên"
                    maxLength={80}
                    onChange={(v) => updateForm('sku', v)}
                    required
                    value={form.sku}
                  />
                  <TextField
                    label="Tên phiên bản"
                    maxLength={120}
                    onChange={(v) => updateForm('variantName', v)}
                    required
                    value={form.variantName}
                  />
                  <TextField
                    label="Khối lượng (gram)"
                    max="100000"
                    min="1"
                    onChange={(v) => updateForm('weightGrams', v)}
                    required
                    type="number"
                    value={form.weightGrams}
                  />
                  <TextField
                    label="Tồn kho ban đầu"
                    max="1000000"
                    min="0"
                    onChange={(v) => updateForm('stockOnHand', v)}
                    required
                    type="number"
                    value={form.stockOnHand}
                  />
                </>
              ) : null}

              <label className="filter-label sm:col-span-2">
                Ảnh WebP (tối đa 5 MiB)
                <input
                  accept="image/webp"
                  className="filter-control"
                  onChange={(event) => setImage(event.target.files?.[0] ?? null)}
                  type="file"
                />
                <span className="mt-1 text-xs text-brand-ink/55">
                  Ảnh chỉ lưu trong Docker volume local, không được commit lên Git.
                </span>
              </label>
              <div className="flex flex-wrap gap-3 sm:col-span-2">
                <button className="button-primary" disabled={pending} type="submit">
                  {pending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
                </button>
                {editing ? (
                  <button
                    className="button-secondary"
                    disabled={pending}
                    onClick={startCreate}
                    type="button"
                  >
                    Hủy chỉnh sửa
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        ) : null}
      </section>
      <AdminOperationsPanel />
    </main>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  maxLength,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: string;
  max?: string;
}) {
  return (
    <label className="filter-label">
      {label}
      <input
        className="filter-control"
        max={max}
        maxLength={maxLength}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        type={type}
        value={value}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogOption[];
}) {
  return (
    <label className="filter-label">
      {label}
      <select
        className="filter-control"
        onChange={(event) => onChange(event.target.value)}
        required
        value={value}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-brand-plum/10 p-3 text-sm">
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}
