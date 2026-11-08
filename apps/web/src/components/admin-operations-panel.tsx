'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';
import { formatVnd } from '../lib/catalog';

type AdminTab = 'orders' | 'vouchers' | 'banners' | 'reviews' | 'customers' | 'audit';
type PageResult<T> = { items: T[]; pagination: { page: number; pages: number; total: number } };

interface AdminOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  communeName: string;
  provinceName: string;
  totalVnd: number;
  user: { name: string; email: string };
  payment: { method: string; status: string } | null;
  items: Array<{
    productName: string;
    variantName: string;
    quantity: number;
    unitPriceVnd: number;
  }>;
  returnRequest: { reason: string; status: string } | null;
}

interface AdminVoucher {
  id: string;
  code: string;
  type: string;
  value: number;
  minSubtotalVnd: number;
  maxDiscountVnd: number | null;
  startsAt: string;
  expiresAt: string;
  totalLimit: number | null;
  perUserLimit: number | null;
  isStackable: boolean;
  _count: { redemptions: number };
}

interface AdminBanner {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  isActive: boolean;
}

function bannerStatus(banner: AdminBanner): string {
  if (!banner.isActive) return 'Đang tắt';
  const now = Date.now();
  if (new Date(banner.startsAt).getTime() > now) return 'Sắp diễn ra';
  if (new Date(banner.endsAt).getTime() <= now) return 'Đã hết hạn';
  return 'Đang hiển thị';
}

interface AdminReview {
  id: string;
  status: string;
  rating: number;
  body: string;
  createdAt: string;
  user: { name: string; email: string };
  product: { name: string; slug: string };
  orderItem: { orderId: string; sku: string };
}

interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: string | null;
  disabledAt: string | null;
  createdAt: string;
  _count: { orders: number; reviews: number };
}

interface AdminAudit {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string } | null;
}

interface VoucherForm {
  code: string;
  type: 'PERCENT' | 'FIXED' | 'FREE_SHIPPING';
  value: string;
  minSubtotalVnd: string;
  maxDiscountVnd: string;
  startsAt: string;
  expiresAt: string;
  totalLimit: string;
  perUserLimit: string;
  isStackable: boolean;
}

interface BannerForm {
  title: string;
  description: string;
  imageUrl: string;
  href: string;
  startsAt: string;
  endsAt: string;
  sortOrder: string;
  isActive: boolean;
}

const tabs: Array<{ id: AdminTab; label: string }> = [
  { id: 'orders', label: 'Đơn hàng' },
  { id: 'vouchers', label: 'Mã ưu đãi' },
  { id: 'banners', label: 'Banner' },
  { id: 'reviews', label: 'Đánh giá' },
  { id: 'customers', label: 'Khách hàng' },
  { id: 'audit', label: 'Nhật ký' },
];

const emptyVoucher = (): VoucherForm => ({
  code: '',
  type: 'PERCENT',
  value: '10',
  minSubtotalVnd: '0',
  maxDiscountVnd: '',
  startsAt: localDateTime(new Date()),
  expiresAt: localDateTime(new Date(Date.now() + 30 * 24 * 60 * 60_000)),
  totalLimit: '',
  perUserLimit: '',
  isStackable: false,
});

const emptyBanner = (): BannerForm => ({
  title: '',
  description: '',
  imageUrl: '',
  href: '/',
  startsAt: localDateTime(new Date()),
  endsAt: localDateTime(new Date(Date.now() + 30 * 24 * 60 * 60_000)),
  sortOrder: '0',
  isActive: false,
});

function localDateTime(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function apiDate(value: string): string {
  return new Date(value).toISOString();
}

function toLocalDateTime(value: string): string {
  return localDateTime(new Date(value));
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(url, init);
  if (!response.ok) {
    let message = `Yêu cầu trả về HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? message);
    } catch (error) {
      console.error('Unable to read the admin operation error response.', error);
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING_PAYMENT: 'Chờ thanh toán',
    PAID: 'Đã thanh toán',
    PROCESSING: 'Đang chuẩn bị',
    SHIPPED: 'Đang giao',
    DELIVERED: 'Đã giao',
    RETURN_REQUESTED: 'Chờ xử lý trả hàng',
    RETURNED: 'Đã trả hàng',
    CANCELLED: 'Đã hủy',
    PAYMENT_FAILED: 'Thanh toán thất bại',
    EXPIRED: 'Hết hạn',
    SIMULATED: 'Mô phỏng',
    PENDING: 'Chờ duyệt',
    APPROVED: 'Đã duyệt',
    REJECTED: 'Đã từ chối',
  };
  return labels[status] ?? status;
}

export default function AdminOperationsPanel() {
  const [tab, setTab] = useState<AdminTab>('orders');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState<Array<AdminOrder | AdminReview | AdminCustomer | AdminAudit>>(
    [],
  );
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [voucherForm, setVoucherForm] = useState<VoucherForm>(emptyVoucher);
  const [editingVoucher, setEditingVoucher] = useState<string | null>(null);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBanner);
  const [editingBanner, setEditingBanner] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(
    async (nextPage: number, nextQuery: string, nextStatus: string) => {
      setPending(true);
      setError('');
      try {
        if (tab === 'vouchers') {
          setVouchers(await requestJson<AdminVoucher[]>('/api/admin/vouchers'));
          setPages(1);
        } else if (tab === 'banners') {
          setBanners(await requestJson<AdminBanner[]>('/api/admin/banners'));
          setPages(1);
        } else {
          const pathByTab: Record<Exclude<AdminTab, 'vouchers' | 'banners'>, string> = {
            orders: 'orders',
            reviews: 'reviews',
            customers: 'customers',
            audit: 'audit-logs',
          };
          const params = new URLSearchParams({ page: String(nextPage), limit: '20' });
          if (nextQuery) params.set('q', nextQuery);
          if (nextStatus) {
            if (tab === 'customers') params.set('state', nextStatus);
            else params.set('status', nextStatus);
          }
          const result = await requestJson<
            PageResult<AdminOrder | AdminReview | AdminCustomer | AdminAudit>
          >(`/api/admin/${pathByTab[tab]}?${params}`);
          setItems(result.items);
          setPages(Math.max(1, result.pagination.pages));
        }
        setPage(nextPage);
      } catch (reason) {
        console.error('Unable to load admin operations.', reason);
        setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu quản trị.');
      } finally {
        setPending(false);
      }
    },
    [tab],
  );

  useEffect(() => {
    void loadData(1, '', '');
  }, [loadData]);

  async function mutate(url: string, init: RequestInit, successMessage: string): Promise<boolean> {
    setPending(true);
    setError('');
    setMessage('');
    try {
      await requestJson(url, init);
      setMessage(successMessage);
      await loadData(page, query, statusFilter);
    } catch (reason) {
      console.error('Unable to save admin operation.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể lưu thay đổi.');
      return false;
    } finally {
      setPending(false);
    }
    return true;
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(queryInput.trim());
    void loadData(1, queryInput.trim(), statusFilter);
  }

  function changeTab(nextTab: AdminTab) {
    setTab(nextTab);
    setPage(1);
    setQuery('');
    setQueryInput('');
    setStatusFilter('');
    setError('');
    setMessage('');
  }

  async function saveVoucher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      ...voucherForm,
      value: Number(voucherForm.value),
      minSubtotalVnd: Number(voucherForm.minSubtotalVnd),
      maxDiscountVnd: voucherForm.maxDiscountVnd ? Number(voucherForm.maxDiscountVnd) : null,
      startsAt: apiDate(voucherForm.startsAt),
      expiresAt: apiDate(voucherForm.expiresAt),
      totalLimit: voucherForm.totalLimit ? Number(voucherForm.totalLimit) : null,
      perUserLimit: voucherForm.perUserLimit ? Number(voucherForm.perUserLimit) : null,
    };
    const saved = await mutate(
      editingVoucher
        ? `/api/admin/vouchers/${encodeURIComponent(editingVoucher)}`
        : '/api/admin/vouchers',
      {
        method: editingVoucher ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      editingVoucher ? 'Đã cập nhật mã ưu đãi.' : 'Đã tạo mã ưu đãi.',
    );
    if (saved) {
      setEditingVoucher(null);
      setVoucherForm(emptyVoucher());
    }
  }

  async function saveBanner(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      ...bannerForm,
      startsAt: apiDate(bannerForm.startsAt),
      endsAt: apiDate(bannerForm.endsAt),
      sortOrder: Number(bannerForm.sortOrder),
    };
    const saved = await mutate(
      editingBanner
        ? `/api/admin/banners/${encodeURIComponent(editingBanner)}`
        : '/api/admin/banners',
      {
        method: editingBanner ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      editingBanner ? 'Đã cập nhật banner.' : 'Đã tạo banner.',
    );
    if (saved) {
      setEditingBanner(null);
      setBannerForm(emptyBanner());
    }
  }

  return (
    <section className="page-shell pb-12" aria-labelledby="admin-operations-title">
      <div className="rounded-3xl bg-white p-5 sm:p-7">
        <div>
          <p className="text-sm font-semibold text-brand-plum">Vận hành cửa hàng</p>
          <h2 className="mt-1 text-2xl font-semibold" id="admin-operations-title">
            Quản lý đơn hàng và nội dung
          </h2>
          <p className="mt-2 text-sm text-brand-ink/65">
            Thanh toán, vận chuyển và trả hàng chỉ được mô phỏng trong dữ liệu local; không có giao
            dịch hay hoàn tiền thật.
          </p>
        </div>
        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-2"
          role="tablist"
          aria-label="Nhóm quản trị"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              aria-selected={tab === item.id}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === item.id ? 'bg-brand-plum text-white' : 'bg-brand-cream text-brand-ink'}`}
              onClick={() => changeTab(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 rounded-2xl bg-brand-mint/50 p-4 text-sm" role="status">
            {message}
          </p>
        ) : null}

        {tab !== 'vouchers' && tab !== 'banners' ? (
          <div className="mt-5">
            <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={submitSearch}>
              <input
                aria-label="Tìm trong dữ liệu quản trị"
                className="filter-control"
                maxLength={120}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Tìm theo tên, mã đơn, email…"
                value={queryInput}
              />
              {tab === 'orders' || tab === 'reviews' ? (
                <select
                  aria-label="Lọc trạng thái"
                  className="filter-control"
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    void loadData(1, query, event.target.value);
                  }}
                  value={statusFilter}
                >
                  <option value="">Mọi trạng thái</option>
                  {(tab === 'orders'
                    ? [
                        ['PENDING_PAYMENT', 'Chờ thanh toán'],
                        ['PROCESSING', 'Đang chuẩn bị'],
                        ['SHIPPED', 'Đang giao'],
                        ['DELIVERED', 'Đã giao'],
                        ['RETURN_REQUESTED', 'Chờ xử lý trả hàng'],
                        ['CANCELLED', 'Đã hủy'],
                      ]
                    : [
                        ['PENDING', 'Chờ duyệt'],
                        ['APPROVED', 'Đã duyệt'],
                        ['REJECTED', 'Đã từ chối'],
                      ]
                  ).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : null}
              {tab === 'customers' ? (
                <select
                  aria-label="Lọc trạng thái khách hàng"
                  className="filter-control"
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    void loadData(1, query, event.target.value);
                  }}
                  value={statusFilter || 'active'}
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="disabled">Đã khóa</option>
                  <option value="all">Tất cả</option>
                </select>
              ) : null}
              <button className="button-secondary" disabled={pending} type="submit">
                Tìm kiếm
              </button>
            </form>
          </div>
        ) : null}

        {pending ? <p className="mt-4 text-sm text-brand-ink/60">Đang tải…</p> : null}
        {tab === 'orders' ? (
          <OrdersView
            items={items as AdminOrder[]}
            pending={pending}
            reasons={reasons}
            onReasonChange={(id, value) => setReasons((current) => ({ ...current, [id]: value }))}
            onCancel={(order) =>
              void mutate(
                `/api/admin/orders/${encodeURIComponent(order.id)}/cancel`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason: reasons[order.id] ?? '' }),
                },
                `Đã hủy đơn ${order.orderNumber}.`,
              )
            }
            onResolveReturn={(order, status) =>
              void mutate(
                `/api/admin/orders/${encodeURIComponent(order.id)}/return`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status, reason: reasons[order.id] ?? '' }),
                },
                status === 'COMPLETED'
                  ? 'Đã hoàn tất yêu cầu trả hàng.'
                  : 'Đã từ chối yêu cầu trả hàng.',
              )
            }
          />
        ) : null}

        {tab === 'vouchers' ? (
          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
            <ul className="space-y-3">
              {vouchers.map((voucher) => (
                <li className="rounded-2xl border border-brand-plum/10 p-4" key={voucher.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{voucher.code}</h3>
                      <p className="mt-1 text-sm text-brand-ink/70">
                        {voucher.type === 'PERCENT'
                          ? `Giảm ${voucher.value}%`
                          : voucher.type === 'FIXED'
                            ? `Giảm ${formatVnd(voucher.value)}`
                            : 'Miễn phí vận chuyển'}
                        {' · '}Tối thiểu {formatVnd(voucher.minSubtotalVnd)}
                      </p>
                      <p className="mt-1 text-xs text-brand-ink/60">
                        {dateLabel(voucher.startsAt)} – {dateLabel(voucher.expiresAt)} · Đã dùng{' '}
                        {voucher._count.redemptions}
                        {voucher.totalLimit === null ? '' : ` / ${voucher.totalLimit}`}
                      </p>
                    </div>
                    <button
                      className="button-secondary"
                      onClick={() => {
                        setEditingVoucher(voucher.id);
                        setVoucherForm({
                          code: voucher.code,
                          type: voucher.type as VoucherForm['type'],
                          value: String(voucher.value),
                          minSubtotalVnd: String(voucher.minSubtotalVnd),
                          maxDiscountVnd:
                            voucher.maxDiscountVnd === null ? '' : String(voucher.maxDiscountVnd),
                          startsAt: toLocalDateTime(voucher.startsAt),
                          expiresAt: toLocalDateTime(voucher.expiresAt),
                          totalLimit: voucher.totalLimit === null ? '' : String(voucher.totalLimit),
                          perUserLimit:
                            voucher.perUserLimit === null ? '' : String(voucher.perUserLimit),
                          isStackable: voucher.isStackable,
                        });
                      }}
                      type="button"
                    >
                      Chỉnh sửa
                    </button>
                  </div>
                </li>
              ))}
              {!vouchers.length ? (
                <li className="text-sm text-brand-ink/60">Chưa có mã ưu đãi.</li>
              ) : null}
            </ul>
            <form
              className="space-y-3 rounded-2xl bg-brand-cream/60 p-4"
              onSubmit={(event) => void saveVoucher(event)}
            >
              <h3 className="font-semibold">
                {editingVoucher ? 'Cập nhật mã ưu đãi' : 'Tạo mã ưu đãi'}
              </h3>
              <Field
                label="Mã"
                value={voucherForm.code}
                onChange={(code) => setVoucherForm({ ...voucherForm, code })}
                required
              />
              <label className="filter-label">
                Loại ưu đãi
                <select
                  className="filter-control"
                  onChange={(event) =>
                    setVoucherForm({
                      ...voucherForm,
                      type: event.target.value as VoucherForm['type'],
                      value: event.target.value === 'FREE_SHIPPING' ? '0' : voucherForm.value,
                      maxDiscountVnd:
                        event.target.value === 'FREE_SHIPPING' ? '' : voucherForm.maxDiscountVnd,
                    })
                  }
                  value={voucherForm.type}
                >
                  <option value="PERCENT">Giảm theo phần trăm</option>
                  <option value="FIXED">Giảm số tiền cố định</option>
                  <option value="FREE_SHIPPING">Miễn phí vận chuyển</option>
                </select>
              </label>
              <Field
                label={
                  voucherForm.type === 'PERCENT'
                    ? 'Giá trị (%)'
                    : 'Giá trị (₫, 0 với miễn phí vận chuyển)'
                }
                max={voucherForm.type === 'PERCENT' ? '100' : '2000000000'}
                min="0"
                onChange={(value) => setVoucherForm({ ...voucherForm, value })}
                required
                type="number"
                value={voucherForm.value}
              />
              <Field
                label="Đơn tối thiểu (₫)"
                min="0"
                onChange={(value) => setVoucherForm({ ...voucherForm, minSubtotalVnd: value })}
                required
                type="number"
                value={voucherForm.minSubtotalVnd}
              />
              {voucherForm.type !== 'FREE_SHIPPING' ? (
                <Field
                  label="Mức giảm tối đa (₫)"
                  min="1"
                  onChange={(value) => setVoucherForm({ ...voucherForm, maxDiscountVnd: value })}
                  type="number"
                  value={voucherForm.maxDiscountVnd}
                />
              ) : null}
              <Field
                label="Bắt đầu"
                onChange={(startsAt) => setVoucherForm({ ...voucherForm, startsAt })}
                required
                type="datetime-local"
                value={voucherForm.startsAt}
              />
              <Field
                label="Hết hạn"
                onChange={(expiresAt) => setVoucherForm({ ...voucherForm, expiresAt })}
                required
                type="datetime-local"
                value={voucherForm.expiresAt}
              />
              <Field
                label="Tổng lượt, để trống nếu không giới hạn"
                min="1"
                onChange={(value) => setVoucherForm({ ...voucherForm, totalLimit: value })}
                type="number"
                value={voucherForm.totalLimit}
              />
              <Field
                label="Lượt mỗi khách, để trống nếu không giới hạn"
                min="1"
                onChange={(value) => setVoucherForm({ ...voucherForm, perUserLimit: value })}
                type="number"
                value={voucherForm.perUserLimit}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={voucherForm.isStackable}
                  onChange={(event) =>
                    setVoucherForm({ ...voucherForm, isStackable: event.target.checked })
                  }
                  type="checkbox"
                />
                Cho phép dùng cùng điểm tích lũy
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="button-primary" disabled={pending} type="submit">
                  {editingVoucher ? 'Lưu mã' : 'Tạo mã'}
                </button>
                {editingVoucher ? (
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setEditingVoucher(null);
                      setVoucherForm(emptyVoucher());
                    }}
                    type="button"
                  >
                    Hủy
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === 'banners' ? (
          <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
            <ul className="space-y-3">
              {banners.map((banner) => (
                <li className="rounded-2xl border border-brand-plum/10 p-4" key={banner.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{banner.title}</h3>
                      <p className="mt-1 break-all text-sm text-brand-ink/70">{banner.imageUrl}</p>
                      <p className="mt-1 text-xs text-brand-ink/60">
                        {bannerStatus(banner)} · {dateLabel(banner.startsAt)} –{' '}
                        {dateLabel(banner.endsAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="button-secondary"
                        onClick={() => {
                          setEditingBanner(banner.id);
                          setBannerForm({
                            title: banner.title,
                            description: banner.description,
                            imageUrl: banner.imageUrl,
                            href: banner.href,
                            startsAt: toLocalDateTime(banner.startsAt),
                            endsAt: toLocalDateTime(banner.endsAt),
                            sortOrder: String(banner.sortOrder),
                            isActive: banner.isActive,
                          });
                        }}
                        type="button"
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        className="button-secondary"
                        disabled={pending}
                        onClick={() => {
                          if (window.confirm(`Xóa banner “${banner.title}”?`)) {
                            void mutate(
                              `/api/admin/banners/${encodeURIComponent(banner.id)}`,
                              { method: 'DELETE' },
                              'Đã xóa banner.',
                            );
                          }
                        }}
                        type="button"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {!banners.length ? (
                <li className="text-sm text-brand-ink/60">Chưa có banner.</li>
              ) : null}
            </ul>
            <form
              className="space-y-3 rounded-2xl bg-brand-cream/60 p-4"
              onSubmit={(event) => void saveBanner(event)}
            >
              <h3 className="font-semibold">{editingBanner ? 'Cập nhật banner' : 'Tạo banner'}</h3>
              <Field
                label="Tiêu đề"
                maxLength={160}
                onChange={(title) => setBannerForm({ ...bannerForm, title })}
                required
                value={bannerForm.title}
              />
              <Field
                label="Mô tả"
                maxLength={500}
                onChange={(description) => setBannerForm({ ...bannerForm, description })}
                value={bannerForm.description}
              />
              <Field
                label="Đường dẫn ảnh cùng origin, ví dụ /products/..."
                maxLength={500}
                onChange={(imageUrl) => setBannerForm({ ...bannerForm, imageUrl })}
                required
                value={bannerForm.imageUrl}
              />
              <Field
                label="Đường dẫn đích trong cửa hàng"
                maxLength={500}
                onChange={(href) => setBannerForm({ ...bannerForm, href })}
                required
                value={bannerForm.href}
              />
              <Field
                label="Bắt đầu"
                onChange={(startsAt) => setBannerForm({ ...bannerForm, startsAt })}
                required
                type="datetime-local"
                value={bannerForm.startsAt}
              />
              <Field
                label="Kết thúc"
                onChange={(endsAt) => setBannerForm({ ...bannerForm, endsAt })}
                required
                type="datetime-local"
                value={bannerForm.endsAt}
              />
              <Field
                label="Thứ tự hiển thị"
                min="0"
                onChange={(sortOrder) => setBannerForm({ ...bannerForm, sortOrder })}
                required
                type="number"
                value={bannerForm.sortOrder}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={bannerForm.isActive}
                  onChange={(event) =>
                    setBannerForm({ ...bannerForm, isActive: event.target.checked })
                  }
                  type="checkbox"
                />
                Bật banner khi nằm trong thời hạn
              </label>
              <div className="flex flex-wrap gap-2">
                <button className="button-primary" disabled={pending} type="submit">
                  {editingBanner ? 'Lưu banner' : 'Tạo banner'}
                </button>
                {editingBanner ? (
                  <button
                    className="button-secondary"
                    onClick={() => {
                      setEditingBanner(null);
                      setBannerForm(emptyBanner());
                    }}
                    type="button"
                  >
                    Hủy
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        ) : null}

        {tab === 'reviews' ? (
          <ul className="mt-5 space-y-3">
            {(items as AdminReview[]).map((review) => (
              <li className="rounded-2xl border border-brand-plum/10 p-4" key={review.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">
                      {review.product.name} · {'★'.repeat(review.rating)}
                    </h3>
                    <p className="text-xs text-brand-ink/60">
                      {review.user.name} · {review.user.email} · {dateLabel(review.createdAt)}
                    </p>
                  </div>
                  <span className="badge">{statusLabel(review.status)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{review.body}</p>
                {review.status === 'PENDING' ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="button-primary"
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          `/api/admin/reviews/${encodeURIComponent(review.id)}`,
                          {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'APPROVED' }),
                          },
                          'Đã duyệt đánh giá.',
                        )
                      }
                      type="button"
                    >
                      Duyệt
                    </button>
                    <button
                      className="button-secondary"
                      disabled={pending}
                      onClick={() =>
                        void mutate(
                          `/api/admin/reviews/${encodeURIComponent(review.id)}`,
                          {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'REJECTED' }),
                          },
                          'Đã từ chối đánh giá.',
                        )
                      }
                      type="button"
                    >
                      Từ chối
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
            {!items.length ? (
              <li className="text-sm text-brand-ink/60">Không có đánh giá phù hợp.</li>
            ) : null}
          </ul>
        ) : null}

        {tab === 'customers' ? (
          <ul className="mt-5 space-y-3">
            {(items as AdminCustomer[]).map((customer) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-plum/10 p-4"
                key={customer.id}
              >
                <div>
                  <h3 className="font-semibold">{customer.name}</h3>
                  <p className="text-sm text-brand-ink/70">{customer.email}</p>
                  <p className="mt-1 text-xs text-brand-ink/60">
                    {customer.emailVerifiedAt ? 'Đã xác minh email' : 'Chưa xác minh'} ·{' '}
                    {customer._count.orders} đơn · {customer._count.reviews} đánh giá · Tham gia{' '}
                    {dateLabel(customer.createdAt)}
                  </p>
                </div>
                <button
                  className={customer.disabledAt ? 'button-primary' : 'button-secondary'}
                  disabled={pending}
                  onClick={() => {
                    if (
                      !customer.disabledAt &&
                      !window.confirm(`Khóa tài khoản ${customer.email}?`)
                    ) {
                      return;
                    }
                    void mutate(
                      `/api/admin/customers/${encodeURIComponent(customer.id)}/status`,
                      {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ disabled: !customer.disabledAt }),
                      },
                      customer.disabledAt ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.',
                    );
                  }}
                  type="button"
                >
                  {customer.disabledAt ? 'Mở khóa' : 'Khóa tài khoản'}
                </button>
              </li>
            ))}
            {!items.length ? (
              <li className="text-sm text-brand-ink/60">Không có khách hàng phù hợp.</li>
            ) : null}
          </ul>
        ) : null}

        {tab === 'audit' ? (
          <ul className="mt-5 space-y-3">
            {(items as AdminAudit[]).map((record) => (
              <li className="rounded-2xl border border-brand-plum/10 p-4" key={record.id}>
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{record.action}</h3>
                    <p className="text-sm text-brand-ink/70">
                      {record.entityType} · {record.entityId ?? '—'} ·{' '}
                      {record.actor?.email ?? 'Tài khoản đã xóa'}
                    </p>
                  </div>
                  <time className="text-xs text-brand-ink/60" dateTime={record.createdAt}>
                    {dateLabel(record.createdAt)}
                  </time>
                </div>
                {record.details ? (
                  <pre className="mt-3 overflow-x-auto rounded-xl bg-brand-cream/60 p-3 text-xs">
                    {JSON.stringify(record.details, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
            {!items.length ? (
              <li className="text-sm text-brand-ink/60">Chưa có bản ghi phù hợp.</li>
            ) : null}
          </ul>
        ) : null}

        {tab === 'orders' || tab === 'reviews' || tab === 'customers' || tab === 'audit' ? (
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-brand-plum/10 pt-4 text-sm">
            <span>
              Trang {page} / {pages}
            </span>
            <div className="flex gap-2">
              <button
                className="button-secondary"
                disabled={pending || page <= 1}
                onClick={() => void loadData(page - 1, query, statusFilter)}
                type="button"
              >
                Trước
              </button>
              <button
                className="button-secondary"
                disabled={pending || page >= pages}
                onClick={() => void loadData(page + 1, query, statusFilter)}
                type="button"
              >
                Sau
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function OrdersView({
  items,
  pending,
  reasons,
  onReasonChange,
  onCancel,
  onResolveReturn,
}: {
  items: AdminOrder[];
  pending: boolean;
  reasons: Record<string, string>;
  onReasonChange: (id: string, value: string) => void;
  onCancel: (order: AdminOrder) => void;
  onResolveReturn: (order: AdminOrder, status: 'COMPLETED' | 'REJECTED') => void;
}) {
  return (
    <ul className="mt-5 space-y-4">
      {items.map((order) => {
        const canCancel =
          order.payment?.status === 'PENDING' &&
          ((order.status === 'PENDING_PAYMENT' && order.payment.method === 'MOCK_TRANSFER') ||
            (order.status === 'PROCESSING' && order.payment.method === 'MOCK_COD'));
        const hasPendingReturn =
          order.status === 'RETURN_REQUESTED' && order.returnRequest?.status === 'REQUESTED';
        return (
          <li className="rounded-2xl border border-brand-plum/10 p-4" key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">
                  {order.orderNumber} · {statusLabel(order.status)}
                </h3>
                <p className="text-sm text-brand-ink/70">
                  {order.user.name} · {order.user.email}
                </p>
                <p className="mt-1 text-xs text-brand-ink/60">
                  {dateLabel(order.createdAt)} · {order.payment?.method ?? 'Không có thanh toán'}
                </p>
              </div>
              <strong>{formatVnd(order.totalVnd)}</strong>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {order.items.map((item, index) => (
                <li key={`${order.id}-${index}`}>
                  {item.productName} · {item.variantName} × {item.quantity} ·{' '}
                  {formatVnd(item.unitPriceVnd)}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-brand-ink/70">
              Giao đến: {order.recipientName} · {order.phone} · {order.streetAddress},{' '}
              {order.communeName}, {order.provinceName}
            </p>
            {order.returnRequest ? (
              <p className="mt-2 rounded-xl bg-brand-cream/60 p-3 text-sm">
                Lý do trả hàng: {order.returnRequest.reason} ·{' '}
                {statusLabel(order.returnRequest.status)}
              </p>
            ) : null}
            {canCancel || hasPendingReturn ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="sr-only" htmlFor={`order-reason-${order.id}`}>
                  Ghi chú xử lý đơn {order.orderNumber}
                </label>
                <input
                  className="filter-control"
                  id={`order-reason-${order.id}`}
                  maxLength={500}
                  onChange={(event) => onReasonChange(order.id, event.target.value)}
                  placeholder={
                    hasPendingReturn ? 'Ghi chú xử lý yêu cầu trả hàng' : 'Lý do hủy đơn'
                  }
                  value={reasons[order.id] ?? ''}
                />
                {canCancel ? (
                  <button
                    className="button-secondary"
                    disabled={pending || !reasons[order.id]?.trim()}
                    onClick={() => onCancel(order)}
                    type="button"
                  >
                    Hủy đơn
                  </button>
                ) : null}
                {hasPendingReturn ? (
                  <>
                    <button
                      className="button-primary"
                      disabled={pending || !reasons[order.id]?.trim()}
                      onClick={() => onResolveReturn(order, 'COMPLETED')}
                      type="button"
                    >
                      Hoàn tất trả hàng
                    </button>
                    <button
                      className="button-secondary"
                      disabled={pending || !reasons[order.id]?.trim()}
                      onClick={() => onResolveReturn(order, 'REJECTED')}
                      type="button"
                    >
                      Từ chối
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
      {!items.length ? (
        <li className="text-sm text-brand-ink/60">Không có đơn hàng phù hợp.</li>
      ) : null}
    </ul>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  min,
  max,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  maxLength?: number;
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
