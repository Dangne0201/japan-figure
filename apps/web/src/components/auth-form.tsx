'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

type AuthMode = 'login' | 'register' | 'forgot' | 'resend' | 'verify' | 'reset';

const endpointByMode: Record<AuthMode, string> = {
  login: '/api/auth/login',
  register: '/api/auth/register',
  forgot: '/api/auth/password/forgot',
  resend: '/api/auth/verification/resend',
  verify: '/api/auth/verify-email',
  reset: '/api/auth/password/reset',
};

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const message =
      typeof body.message === 'object' && body.message !== null && 'message' in body.message
        ? body.message.message
        : body.message;
    if (Array.isArray(message)) {
      return message.filter((item): item is string => typeof item === 'string').join(' ');
    }
    if (typeof message === 'string') return message;
  } catch {
    return 'Đã xảy ra lỗi. Vui lòng thử lại.';
  }
  return 'Đã xảy ra lỗi. Vui lòng thử lại.';
}

export default function AuthForm({ mode, token }: { mode: AuthMode; token?: string | undefined }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setPending(true);

    const formData = new FormData(event.currentTarget);
    const body: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string' && value) body[key] = value;
    }
    if (mode === 'verify' || mode === 'reset') body.token = token ?? '';

    try {
      const response = await fetch(endpointByMode[mode], {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(await getErrorMessage(response));
        return;
      }

      if (mode === 'login') {
        router.push('/account');
        return;
      }

      if (mode === 'verify') {
        setMessage('Email đã được xác minh. Bạn có thể đăng nhập.');
      } else if (mode === 'reset') {
        setMessage('Mật khẩu đã được cập nhật. Hãy đăng nhập bằng mật khẩu mới.');
      } else if (mode === 'register') {
        setMessage(
          'Đăng ký thành công. Hãy mở Mailpit để lấy liên kết xác minh email trước khi đăng nhập.',
        );
      } else if (mode === 'forgot') {
        setMessage(
          'Nếu email thuộc tài khoản, hướng dẫn đặt lại mật khẩu đã được gửi qua Mailpit.',
        );
      } else {
        setMessage('Nếu tài khoản cần xác minh, email hướng dẫn sẽ được gửi qua Mailpit.');
      }
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setPending(false);
    }
  }

  const fields: Record<AuthMode, Array<{ name: string; label: string; type: string }>> = {
    login: [
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Mật khẩu', type: 'password' },
    ],
    register: [
      { name: 'name', label: 'Tên hiển thị', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'password', label: 'Mật khẩu (ít nhất 12 ký tự)', type: 'password' },
    ],
    forgot: [{ name: 'email', label: 'Email tài khoản', type: 'email' }],
    resend: [{ name: 'email', label: 'Email tài khoản', type: 'email' }],
    verify: [],
    reset: [{ name: 'password', label: 'Mật khẩu mới (ít nhất 12 ký tự)', type: 'password' }],
  };
  const buttonLabels: Record<AuthMode, string> = {
    login: 'Đăng nhập',
    register: 'Tạo tài khoản',
    forgot: 'Gửi hướng dẫn',
    resend: 'Gửi lại email xác minh',
    verify: 'Xác minh email',
    reset: 'Đặt lại mật khẩu',
  };

  return (
    <section className="w-full max-w-md rounded-3xl border border-brand-plum/10 bg-white p-6 shadow-soft sm:p-8">
      {message ? (
        <div
          className="mb-5 rounded-2xl border border-emerald-700/15 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900"
          role="status"
        >
          {message}
        </div>
      ) : null}
      {error ? (
        <div
          className="mb-5 rounded-2xl border border-red-700/15 bg-red-50 p-4 text-sm leading-6 text-red-900"
          role="alert"
        >
          {error}
        </div>
      ) : null}
      <form action={endpointByMode[mode]} className="space-y-5" method="post" onSubmit={submit}>
        {fields[mode].map((field) => (
          <label className="filter-label" key={field.name}>
            {field.label}
            <input
              autoComplete={
                field.name === 'password'
                  ? mode === 'reset'
                    ? 'new-password'
                    : mode === 'register'
                      ? 'new-password'
                      : 'current-password'
                  : field.name
              }
              className="filter-control"
              maxLength={field.name === 'name' ? 120 : field.name === 'password' ? 64 : 254}
              minLength={field.name === 'password' ? 12 : undefined}
              name={field.name}
              required
              type={field.type}
            />
          </label>
        ))}
        {mode === 'verify' && !token ? (
          <p className="text-sm text-red-800" role="alert">
            Liên kết xác minh không có token. Hãy mở liên kết đầy đủ trong Mailpit.
          </p>
        ) : null}
        {mode === 'verify' || mode === 'reset' ? (
          <input name="token" type="hidden" value={token ?? ''} />
        ) : null}
        <button
          className="button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending || (mode === 'verify' && !token)}
          type="submit"
        >
          {pending ? 'Đang xử lý…' : buttonLabels[mode]}
        </button>
      </form>

      <nav
        className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm text-brand-plum"
        aria-label="Tài khoản"
      >
        {mode === 'login' ? (
          <>
            <Link href="/forgot-password">Quên mật khẩu?</Link>
            <Link href="/register">Tạo tài khoản</Link>
          </>
        ) : null}
        {mode === 'register' ? (
          <>
            <Link href="/login">Đã có tài khoản? Đăng nhập</Link>
            <Link href="/verify-email/resend">Gửi lại email xác minh</Link>
          </>
        ) : null}
        {mode === 'forgot' ? <Link href="/login">Quay lại đăng nhập</Link> : null}
        {mode === 'resend' ? <Link href="/login">Quay lại đăng nhập</Link> : null}
        {mode === 'verify' ? (
          <>
            <Link href="/login">Đăng nhập</Link>
            <Link href="/verify-email/resend">Gửi lại email xác minh</Link>
          </>
        ) : null}
        {mode === 'reset' ? <Link href="/forgot-password">Yêu cầu liên kết mới</Link> : null}
      </nav>
    </section>
  );
}
