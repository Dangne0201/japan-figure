'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';

interface AdminConversation {
  id: string;
  title: string;
  updatedAt: string;
  user: { id: string; name: string; email: string };
  _count: { messages: number };
  messages: Array<{
    role: 'USER' | 'ASSISTANT';
    content: string;
    feedback: 'HELPFUL' | 'NOT_HELPFUL' | null;
    createdAt: string;
  }>;
}

interface AdminMessage {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  sources: Array<{ title: string; path: string | null }> | null;
  feedback: 'HELPFUL' | 'NOT_HELPFUL' | null;
}

interface ConversationDetail {
  id: string;
  title: string;
  user: { id: string; name: string; email: string };
  messages: AdminMessage[];
}

interface PageResult<T> {
  items: T[];
  pagination: { page: number; pages: number; total: number };
}

type Access = 'loading' | 'guest' | 'forbidden' | 'ready' | 'error';

async function requestJson<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    let message = `Yêu cầu trả về HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? message);
    } catch (error) {
      console.error('Unable to read the admin chatbot error response.', error);
    }
    throw Object.assign(new Error(message), { status: response.status });
  }
  return (await response.json()) as T;
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export default function AdminChatConsole() {
  const [access, setAccess] = useState<Access>('loading');
  const [items, setItems] = useState<AdminConversation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(
    async (nextPage: number, nextQuery: string, nextFeedback: string) => {
      const params = new URLSearchParams({ page: String(nextPage), limit: '25' });
      if (nextQuery) params.set('q', nextQuery);
      if (nextFeedback) params.set('feedback', nextFeedback);
      const result = await requestJson<PageResult<AdminConversation>>(
        `/api/admin/chat/conversations?${params}`,
      );
      setItems(result.items);
      setPages(Math.max(1, result.pagination.pages));
      setPage(nextPage);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const response = await authenticatedFetch('/api/auth/me');
        if (response.status === 401) {
          if (active) setAccess('guest');
          return;
        }
        if (!response.ok)
          throw new Error(`Không thể xác minh quyền quản trị (HTTP ${response.status}).`);
        const profile = (await response.json()) as { role: string };
        if (!active) return;
        if (profile.role !== 'ADMIN') {
          setAccess('forbidden');
          return;
        }
        await loadList(1, '', '');
        if (active) setAccess('ready');
      } catch (reason) {
        if (!active) return;
        console.error('Unable to initialize admin chatbot console.', reason);
        setError(reason instanceof Error ? reason.message : 'Không thể tải dữ liệu chatbot.');
        setAccess('error');
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [loadList]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = searchInput.trim();
    setQuery(nextQuery);
    setPending(true);
    setError('');
    try {
      await loadList(1, nextQuery, feedback);
    } catch (reason) {
      console.error('Unable to search admin chatbot conversations.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể tìm cuộc trò chuyện.');
    } finally {
      setPending(false);
    }
  }

  async function selectFeedback(value: string) {
    setFeedback(value);
    setPending(true);
    setError('');
    try {
      await loadList(1, query, value);
    } catch (reason) {
      console.error('Unable to filter admin chatbot feedback.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể lọc đánh giá.');
    } finally {
      setPending(false);
    }
  }

  async function openConversation(id: string) {
    setSelectedId(id);
    setDetail(null);
    setPending(true);
    setError('');
    try {
      setDetail(
        await requestJson<ConversationDetail>(
          `/api/admin/chat/conversations/${encodeURIComponent(id)}`,
        ),
      );
    } catch (reason) {
      console.error('Unable to load admin chatbot conversation.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể tải nội dung trò chuyện.');
    } finally {
      setPending(false);
    }
  }

  async function changePage(nextPage: number) {
    setPending(true);
    setError('');
    try {
      await loadList(nextPage, query, feedback);
    } catch (reason) {
      console.error('Unable to paginate admin chatbot conversations.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể tải trang tiếp theo.');
    } finally {
      setPending(false);
    }
  }

  if (access === 'loading') {
    return (
      <main id="main-content" tabIndex={-1} className="page-shell py-12">
        Đang kiểm tra quyền quản trị…
      </main>
    );
  }

  if (access === 'guest' || access === 'forbidden' || access === 'error') {
    return (
      <main id="main-content" tabIndex={-1} className="page-shell py-12">
        <h1 className="text-2xl font-semibold">Quản lý chatbot</h1>
        <p className="mt-3 text-sm text-red-900" role="alert">
          {access === 'guest'
            ? 'Vui lòng đăng nhập bằng tài khoản quản trị.'
            : access === 'forbidden'
              ? 'Bạn không có quyền truy cập khu vực này.'
              : error}
        </p>
        <Link className="button-secondary mt-5" href="/admin">
          Quay lại trang quản trị
        </Link>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="page-shell py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-brand-plum">Quản trị mô phỏng</p>
          <h1 className="mt-1 text-3xl font-semibold">Hội thoại chatbot</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/70">
            Nội dung chỉ dùng để kiểm tra chất lượng trợ lý. Hãy xem thông tin cá nhân trong hội
            thoại là dữ liệu riêng tư.
          </p>
        </div>
        <Link className="button-secondary" href="/admin">
          Về trang quản trị
        </Link>
      </div>

      {error ? (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-3xl bg-white p-4 sm:p-5" aria-label="Danh sách hội thoại">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={search}>
            <label className="sr-only" htmlFor="chat-search">
              Tìm theo tên, email hoặc tiêu đề
            </label>
            <input
              className="filter-control"
              id="chat-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tên, email hoặc tiêu đề…"
              value={searchInput}
            />
            <button className="button-secondary" disabled={pending} type="submit">
              Tìm
            </button>
          </form>
          <label className="mt-3 block text-sm font-medium">
            Lọc theo phản hồi
            <select
              className="filter-control mt-2"
              disabled={pending}
              onChange={(event) => void selectFeedback(event.target.value)}
              value={feedback}
            >
              <option value="">Mọi hội thoại</option>
              <option value="HELPFUL">Có ích</option>
              <option value="NOT_HELPFUL">Chưa hữu ích</option>
            </select>
          </label>

          <p className="mt-4 text-xs text-brand-ink/60">{items.length} hội thoại trên trang</p>
          <ul className="mt-2 max-h-[60vh] space-y-2 overflow-y-auto">
            {items.map((item) => {
              const latest = item.messages[0];
              return (
                <li key={item.id}>
                  <button
                    aria-current={selectedId === item.id ? 'true' : undefined}
                    className={`w-full rounded-2xl border p-3 text-left ${selectedId === item.id ? 'border-brand-plum bg-brand-cream' : 'border-brand-plum/10 hover:bg-brand-cream/60'}`}
                    disabled={pending}
                    onClick={() => void openConversation(item.id)}
                    type="button"
                  >
                    <span className="block truncate text-sm font-semibold">{item.title}</span>
                    <span className="mt-1 block truncate text-xs text-brand-ink/70">
                      {item.user.name} · {item.user.email}
                    </span>
                    {latest ? (
                      <span className="mt-2 block truncate text-xs text-brand-ink/65">
                        {latest.role === 'USER' ? 'Khách: ' : 'Trợ lý: '}
                        {latest.content}
                      </span>
                    ) : null}
                    <span className="mt-2 flex justify-between text-[11px] text-brand-ink/55">
                      <span>{item._count.messages} tin nhắn</span>
                      <span>{dateLabel(item.updatedAt)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              className="button-secondary min-h-10 px-3 text-xs"
              disabled={pending || page <= 1}
              onClick={() => void changePage(page - 1)}
              type="button"
            >
              Trang trước
            </button>
            <span className="text-xs">
              {page}/{pages}
            </span>
            <button
              className="button-secondary min-h-10 px-3 text-xs"
              disabled={pending || page >= pages}
              onClick={() => void changePage(page + 1)}
              type="button"
            >
              Trang sau
            </button>
          </div>
        </section>

        <section
          className="min-h-[50vh] rounded-3xl bg-white p-4 sm:p-6"
          aria-label="Nội dung hội thoại"
        >
          {!selectedId ? (
            <p className="text-sm text-brand-ink/65">
              Chọn một hội thoại để xem nội dung và phản hồi của khách.
            </p>
          ) : pending && !detail ? (
            <p className="text-sm text-brand-ink/65">Đang tải nội dung hội thoại…</p>
          ) : detail ? (
            <>
              <div className="border-b border-brand-plum/10 pb-4">
                <h2 className="text-lg font-semibold">{detail.title}</h2>
                <p className="mt-1 text-sm text-brand-ink/70">
                  {detail.user.name} · {detail.user.email}
                </p>
              </div>
              <ol className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto">
                {detail.messages.map((message) => (
                  <li
                    className={`rounded-2xl p-4 ${message.role === 'USER' ? 'bg-brand-cream' : 'bg-brand-mint/30'}`}
                    key={message.id}
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-xs text-brand-ink/65">
                      <span className="font-semibold">
                        {message.role === 'USER' ? 'Khách hàng' : 'Trợ lý'}
                      </span>
                      <span>{dateLabel(message.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                      {message.content}
                    </p>
                    {message.role === 'ASSISTANT' ? (
                      <p className="mt-3 text-xs text-brand-ink/70">
                        Phản hồi:{' '}
                        {message.feedback === 'HELPFUL'
                          ? 'Có ích'
                          : message.feedback === 'NOT_HELPFUL'
                            ? 'Chưa hữu ích'
                            : 'Chưa đánh giá'}
                      </p>
                    ) : null}
                    {message.sources?.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-brand-ink/65">
                        {message.sources.map((source, index) => (
                          <li key={`${source.title}-${index}`}>
                            Nguồn [{index + 1}]: {source.title}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-brand-ink/55">
                Chỉ hiển thị tối đa 50 tin nhắn gần nhất.
              </p>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
