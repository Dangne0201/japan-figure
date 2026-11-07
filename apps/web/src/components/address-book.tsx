'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';

interface Province {
  code: string;
  name: string;
}

interface Commune {
  code: string;
  name: string;
  type: string;
  provinceCode: string;
}

interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  provinceCode: string;
  provinceName: string;
  communeCode: string;
  communeName: string;
  communeType: string;
  isDefault: boolean;
}

interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  streetAddress: string;
  provinceCode: string;
  communeCode: string;
  isDefault: boolean;
}

interface ReferenceData {
  source: string;
  retrievedAt: string;
  provinces: Province[];
  communes: Commune[];
}

const emptyAddress = (): AddressInput => ({
  label: '',
  recipientName: '',
  phone: '',
  streetAddress: '',
  provinceCode: '',
  communeCode: '',
  isDefault: false,
});

export default function AddressBook() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [form, setForm] = useState<AddressInput>(emptyAddress);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const communes = useMemo(
    () => reference?.communes.filter((commune) => commune.provinceCode === form.provinceCode) ?? [],
    [form.provinceCode, reference],
  );

  async function load() {
    setError('');
    try {
      const [referenceResponse, addressesResponse] = await Promise.all([
        fetch('/api/addresses/reference', { cache: 'force-cache' }),
        authenticatedFetch('/api/addresses', { cache: 'no-store' }),
      ]);
      if (addressesResponse.status === 401) {
        setNeedsLogin(true);
        return;
      }
      if (!referenceResponse.ok || !addressesResponse.ok) {
        throw new Error('Không thể tải dữ liệu địa chỉ.');
      }
      setReference((await referenceResponse.json()) as ReferenceData);
      setAddresses((await addressesResponse.json()) as Address[]);
    } catch (reason) {
      console.error('Unable to load address book.', reason);
      setError('Không thể tải sổ địa chỉ. Hãy kiểm tra API/database rồi thử lại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function edit(address: Address) {
    setEditingId(address.id);
    setForm({
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      streetAddress: address.streetAddress,
      provinceCode: address.provinceCode,
      communeCode: address.communeCode,
      isDefault: address.isDefault,
    });
    setMessage('');
    setError('');
  }

  function resetForm() {
    setEditingId('');
    setForm(emptyAddress());
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await authenticatedFetch(
        editingId ? `/api/addresses/${encodeURIComponent(editingId)}` : '/api/addresses',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      if (!response.ok) {
        const result = (await response.json()) as { message?: string | string[] };
        throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message);
      }
      resetForm();
      setMessage(editingId ? 'Đã cập nhật địa chỉ.' : 'Đã thêm địa chỉ.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể lưu địa chỉ.');
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    setPending(true);
    setError('');
    setMessage('');
    try {
      const response = await authenticatedFetch(`/api/addresses/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Không thể xóa địa chỉ.');
      setAddresses((current) => current.filter((address) => address.id !== id));
      setMessage('Đã xóa địa chỉ.');
      if (editingId === id) resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể xóa địa chỉ.');
    } finally {
      setPending(false);
    }
  }

  async function setDefault(id: string) {
    setPending(true);
    setError('');
    try {
      const response = await authenticatedFetch(
        `/api/addresses/${encodeURIComponent(id)}/default`,
        {
          method: 'POST',
        },
      );
      if (!response.ok) throw new Error('Không thể đặt địa chỉ mặc định.');
      await load();
      setMessage('Đã cập nhật địa chỉ mặc định.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể cập nhật địa chỉ.');
    } finally {
      setPending(false);
    }
  }

  if (loading) return <p className="rounded-2xl bg-white p-6">Đang tải sổ địa chỉ…</p>;
  if (needsLogin) {
    return (
      <section className="rounded-3xl bg-white p-6">
        <p>Vui lòng đăng nhập để quản lý địa chỉ nhận hàng.</p>
        <Link className="button-primary mt-5" href="/login">
          Đăng nhập
        </Link>
      </section>
    );
  }

  return (
    <div className="w-full space-y-6">
      {error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {message}
        </p>
      ) : null}
      <section className="space-y-3">
        {addresses.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-brand-ink/70">
            Bạn chưa lưu địa chỉ nào.
          </p>
        ) : (
          addresses.map((address) => (
            <article
              className="rounded-3xl border border-brand-plum/10 bg-white p-5"
              key={address.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {address.label}
                    {address.isDefault ? ' · Mặc định' : ''}
                  </h2>
                  <p className="mt-2 text-sm">
                    {address.recipientName} · {address.phone}
                  </p>
                  <p className="mt-1 text-sm text-brand-ink/70">
                    {address.streetAddress}, {address.communeType} {address.communeName},{' '}
                    {address.provinceName}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-brand-plum">
                  {!address.isDefault ? (
                    <button
                      disabled={pending}
                      onClick={() => void setDefault(address.id)}
                      type="button"
                    >
                      Đặt mặc định
                    </button>
                  ) : null}
                  <button disabled={pending} onClick={() => edit(address)} type="button">
                    Sửa
                  </button>
                  <button disabled={pending} onClick={() => void remove(address.id)} type="button">
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="rounded-3xl border border-brand-plum/10 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-semibold">{editingId ? 'Sửa địa chỉ' : 'Thêm địa chỉ mới'}</h2>
        <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void save(event)}>
          <label className="filter-label">
            Tên gợi nhớ
            <input
              className="filter-control"
              maxLength={60}
              onChange={(event) => setForm({ ...form, label: event.target.value })}
              required
              value={form.label}
            />
          </label>
          <label className="filter-label">
            Người nhận
            <input
              className="filter-control"
              autoComplete="name"
              maxLength={120}
              onChange={(event) => setForm({ ...form, recipientName: event.target.value })}
              required
              value={form.recipientName}
            />
          </label>
          <label className="filter-label">
            Số điện thoại
            <input
              className="filter-control"
              autoComplete="tel"
              maxLength={16}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              pattern="^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$"
              required
              type="tel"
              value={form.phone}
            />
          </label>
          <label className="filter-label">
            Tỉnh/thành
            <select
              className="filter-control"
              onChange={(event) =>
                setForm({ ...form, provinceCode: event.target.value, communeCode: '' })
              }
              required
              value={form.provinceCode}
            >
              <option value="">Chọn tỉnh/thành</option>
              {reference?.provinces.map((province) => (
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-label">
            Xã/phường/đặc khu
            <select
              className="filter-control"
              disabled={!form.provinceCode}
              onChange={(event) => setForm({ ...form, communeCode: event.target.value })}
              required
              value={form.communeCode}
            >
              <option value="">Chọn xã/phường/đặc khu</option>
              {communes.map((commune) => (
                <option key={commune.code} value={commune.code}>
                  {commune.type} {commune.name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-label sm:col-span-2">
            Địa chỉ chi tiết
            <input
              className="filter-control"
              autoComplete="street-address"
              maxLength={255}
              onChange={(event) => setForm({ ...form, streetAddress: event.target.value })}
              placeholder="Số nhà, đường, khu phố/thôn..."
              required
              value={form.streetAddress}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              checked={form.isDefault}
              onChange={(event) => setForm({ ...form, isDefault: event.target.checked })}
              type="checkbox"
            />
            Đặt làm địa chỉ mặc định
          </label>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="button-primary" disabled={pending} type="submit">
              {pending ? 'Đang lưu…' : editingId ? 'Lưu thay đổi' : 'Thêm địa chỉ'}
            </button>
            {editingId ? (
              <button
                className="button-secondary"
                disabled={pending}
                onClick={resetForm}
                type="button"
              >
                Hủy sửa
              </button>
            ) : null}
          </div>
        </form>
        {reference ? (
          <p className="mt-5 text-xs text-brand-ink/50">
            Danh mục hành chính: Cục Thống kê · cập nhật {reference.retrievedAt}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
