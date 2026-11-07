'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';

interface Profile {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  emailVerifiedAt: string;
}

async function readProfile(): Promise<Response> {
  return authenticatedFetch('/api/auth/me');
}

export default function AccountProfile() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await readProfile();
        if (!response.ok) {
          if (active) setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          return;
        }
        const result = (await response.json()) as Profile;
        if (active) setProfile(result);
      } catch {
        if (active) setError('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    setMessage('');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await authenticatedFetch('/api/auth/profile', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.get('name') }),
      });
      if (!response.ok) {
        setError('Không thể cập nhật hồ sơ. Vui lòng kiểm tra thông tin và thử lại.');
        return;
      }
      setProfile((await response.json()) as Profile);
      setMessage('Hồ sơ đã được cập nhật.');
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    setPending(true);
    try {
      const response = await authenticatedFetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        setError('Không thể đăng xuất. Vui lòng thử lại.');
        setPending(false);
        return;
      }
      router.push('/login');
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
      setPending(false);
    }
  }

  if (loading) {
    return <p className="rounded-2xl bg-white p-6 text-sm">Đang tải hồ sơ…</p>;
  }

  if (!profile) {
    return (
      <section className="w-full max-w-md rounded-3xl border border-brand-plum/10 bg-white p-6">
        <p className="text-sm leading-6 text-red-900" role="alert">
          {error}
        </p>
        <Link className="button-primary mt-5" href="/login">
          Đăng nhập
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-md rounded-3xl border border-brand-plum/10 bg-white p-6 shadow-soft sm:p-8">
      <p className="mb-5 text-sm text-brand-ink/70">{profile.email}</p>
      {error ? (
        <p className="mb-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mb-4 text-sm text-emerald-900" role="status">
          {message}
        </p>
      ) : null}
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        <Link className="font-semibold text-brand-plum underline" href="/account/addresses">
          Sổ địa chỉ
        </Link>
        <Link className="font-semibold text-brand-plum underline" href="/cart">
          Giỏ hàng
        </Link>
        <Link className="font-semibold text-brand-plum underline" href="/account/orders">
          Đơn hàng
        </Link>
        <Link className="font-semibold text-brand-plum underline" href="/account/wishlist">
          Yêu thích
        </Link>
      </div>
      <form className="space-y-5" onSubmit={update}>
        <label className="filter-label">
          Tên hiển thị
          <input
            className="filter-control"
            defaultValue={profile.name}
            maxLength={120}
            minLength={1}
            name="name"
            required
          />
        </label>
        <button className="button-primary w-full" disabled={pending} type="submit">
          Lưu thay đổi
        </button>
      </form>
      <p className="mt-5 text-xs text-brand-ink/60">
        Vai trò: {profile.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
      </p>
      <button
        className="button-secondary mt-4 w-full"
        disabled={pending}
        onClick={() => void logout()}
        type="button"
      >
        Đăng xuất
      </button>
    </section>
  );
}
