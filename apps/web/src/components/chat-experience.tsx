'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { authenticatedFetch } from '../lib/api';
import { readServerSentEvents } from '../lib/chat-stream';

interface Profile {
  role: 'USER' | 'ADMIN';
  emailVerifiedAt: string | null;
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface Citation {
  type: 'document' | 'product';
  id: string;
  title: string;
  path: string | null;
  chunkIndex: number;
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  createdAt: string;
  sources: Citation[] | null;
  feedback: 'HELPFUL' | 'NOT_HELPFUL' | null;
}

type AccessState = 'loading' | 'guest' | 'unverified' | 'ready' | 'error';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Yêu cầu trả về HTTP ${response.status}.`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(' ') : (body.message ?? message);
    } catch (error) {
      console.error('Unable to read chat API error response.', error);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function safeSourceHref(source: Citation): string | null {
  if (source.path?.startsWith('/') && !source.path.startsWith('//')) return source.path;
  return null;
}

export default function ChatExperience() {
  const [access, setAccess] = useState<AccessState>('loading');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatStatus, setChatStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const tailRef = useRef<HTMLDivElement>(null);
  const loadSequence = useRef(0);

  const loadConversations = useCallback(async () => {
    const response = await authenticatedFetch('/api/chat/conversations?page=1&limit=50');
    const result = await readJson<{ items: Conversation[] }>(response);
    setConversations(result.items);
    return result.items;
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const sequence = ++loadSequence.current;
    const result = await readJson<{
      messages: Message[];
    }>(await authenticatedFetch(`/api/chat/conversations/${encodeURIComponent(id)}`));
    if (sequence === loadSequence.current) setMessages(result.messages);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const profileResponse = await authenticatedFetch('/api/auth/me');
        if (profileResponse.status === 401) {
          if (active) setAccess('guest');
          return;
        }
        const profile = await readJson<Profile>(profileResponse);
        if (!active) return;
        if (!profile.emailVerifiedAt) {
          setAccess('unverified');
          return;
        }
        const items = await loadConversations();
        if (!active) return;
        setAccess('ready');
        if (items[0]) {
          setConversationId(items[0].id);
          await loadConversation(items[0].id);
        }
      } catch (reason) {
        if (active) {
          console.error('Unable to initialize the chatbot experience.', reason);
          setError(reason instanceof Error ? reason.message : 'Không thể tải cuộc trò chuyện.');
          setAccess('error');
        }
      }
    }
    void initialize();
    return () => {
      active = false;
      loadSequence.current += 1;
    };
  }, [loadConversation, loadConversations]);

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: 'end', behavior: sending ? 'auto' : 'smooth' });
  }, [messages, sending]);

  async function selectConversation(id: string) {
    setConversationId(id);
    setMessages([]);
    setError('');
    setNotice('');
    setPending(true);
    try {
      await loadConversation(id);
    } catch (reason) {
      console.error('Unable to load chatbot conversation.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể tải cuộc trò chuyện.');
    } finally {
      setPending(false);
    }
  }

  async function createConversation() {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const created = await readJson<Conversation>(
        await authenticatedFetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }),
      );
      setConversationId(created.id);
      setMessages([]);
      setConversations((current) => [created, ...current]);
    } catch (reason) {
      console.error('Unable to create chatbot conversation.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể tạo cuộc trò chuyện.');
    } finally {
      setPending(false);
    }
  }

  async function deleteConversation() {
    if (!conversationId || sending || !window.confirm('Xóa cuộc trò chuyện này?')) return;
    setPending(true);
    setError('');
    try {
      await readJson<{ deleted: boolean }>(
        await authenticatedFetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, {
          method: 'DELETE',
        }),
      );
      const remaining = conversations.filter((item) => item.id !== conversationId);
      setConversations(remaining);
      setConversationId(remaining[0]?.id ?? '');
      setMessages([]);
      if (remaining[0]) await loadConversation(remaining[0].id);
    } catch (reason) {
      console.error('Unable to delete chatbot conversation.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể xóa cuộc trò chuyện.');
    } finally {
      setPending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = content.trim();
    if (!question || !conversationId || sending) return;

    const temporaryUserId = `user-${Date.now()}`;
    const temporaryAssistantId = `assistant-${Date.now()}`;
    setContent('');
    setError('');
    setNotice('');
    setChatStatus('Đang tìm trong tài liệu cửa hàng…');
    setSending(true);
    setMessages((current) => [
      ...current,
      {
        id: temporaryUserId,
        role: 'USER',
        content: question,
        createdAt: new Date().toISOString(),
        sources: null,
        feedback: null,
      },
      {
        id: temporaryAssistantId,
        role: 'ASSISTANT',
        content: '',
        createdAt: new Date().toISOString(),
        sources: [],
        feedback: null,
      },
    ]);

    try {
      const response = await authenticatedFetch(
        `/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: question }),
        },
      );
      if (!response.ok) {
        await readJson(response);
        return;
      }
      if (!response.body) throw new Error('Máy chủ không hỗ trợ phản hồi streaming.');

      let serverError = '';
      for await (const event of readServerSentEvents(response.body)) {
        if (event.event === 'sources' && Array.isArray(event.data)) {
          setChatStatus('Đang tổng hợp câu trả lời từ nguồn phù hợp…');
          setMessages((current) =>
            current.map((message) =>
              message.id === temporaryAssistantId
                ? { ...message, sources: event.data as Citation[] }
                : message,
            ),
          );
        } else if (event.event === 'token') {
          const token = (event.data as { text?: unknown }).text;
          if (typeof token === 'string') {
            setChatStatus('');
            setMessages((current) =>
              current.map((message) =>
                message.id === temporaryAssistantId
                  ? { ...message, content: message.content + token }
                  : message,
              ),
            );
          }
        } else if (event.event === 'error') {
          const message = (event.data as { message?: unknown }).message;
          serverError = typeof message === 'string' ? message : 'Trợ lý chưa thể trả lời lúc này.';
        }
      }
      if (serverError) setError(serverError);
      else setNotice('Câu trả lời chỉ dựa trên nguồn được liệt kê bên dưới.');
      await loadConversation(conversationId);
      const items = await loadConversations();
      setConversations(items);
    } catch (reason) {
      console.error('Unable to stream chatbot response.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể gửi tin nhắn.');
      try {
        await loadConversation(conversationId);
      } catch (reloadError) {
        console.error('Unable to reload conversation after chat failure.', reloadError);
      }
    } finally {
      setChatStatus('');
      setSending(false);
    }
  }

  async function saveFeedback(messageId: string, rating: 'HELPFUL' | 'NOT_HELPFUL') {
    setError('');
    try {
      await readJson(
        await authenticatedFetch(`/api/chat/messages/${encodeURIComponent(messageId)}/feedback`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating }),
        }),
      );
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId ? { ...message, feedback: rating } : message,
        ),
      );
    } catch (reason) {
      console.error('Unable to save chatbot feedback.', reason);
      setError(reason instanceof Error ? reason.message : 'Không thể lưu đánh giá.');
    }
  }

  if (access === 'loading') {
    return <p className="rounded-3xl bg-white p-6 text-sm">Đang kiểm tra phiên đăng nhập…</p>;
  }

  if (access === 'guest' || access === 'unverified') {
    return (
      <section className="rounded-3xl border border-brand-plum/10 bg-white p-6 sm:p-8">
        <h2 className="text-xl font-semibold">
          {access === 'guest' ? 'Đăng nhập để trò chuyện' : 'Xác minh email để tiếp tục'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-brand-ink/70">
          Cuộc trò chuyện được lưu riêng trong tài khoản của bạn. Cần đăng nhập và xác minh email
          trước khi sử dụng.
        </p>
        <Link className="button-primary mt-5" href={access === 'guest' ? '/login' : '/account'}>
          {access === 'guest' ? 'Đăng nhập' : 'Tới tài khoản'}
        </Link>
      </section>
    );
  }

  return (
    <section className="grid min-h-[70vh] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-brand-plum/10 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Lịch sử trò chuyện</h2>
          <button
            className="button-secondary min-h-10 px-3 text-xs"
            disabled={pending || sending}
            onClick={() => void createConversation()}
            type="button"
          >
            Cuộc mới
          </button>
        </div>
        {conversations.length ? (
          <ul className="mt-4 flex max-h-56 gap-2 overflow-x-auto lg:max-h-[60vh] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
            {conversations.map((conversation) => (
              <li className="min-w-52 lg:min-w-0" key={conversation.id}>
                <button
                  aria-current={conversation.id === conversationId ? 'page' : undefined}
                  className={`w-full rounded-2xl p-3 text-left text-sm ${conversation.id === conversationId ? 'bg-brand-plum text-white' : 'bg-brand-cream hover:bg-brand-mint/50'}`}
                  disabled={pending || sending}
                  onClick={() => void selectConversation(conversation.id)}
                  type="button"
                >
                  <span className="block truncate font-semibold">{conversation.title}</span>
                  <span className="mt-1 block text-xs opacity-70">
                    {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(
                      new Date(conversation.updatedAt),
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm leading-6 text-brand-ink/65">
            Chưa có cuộc trò chuyện nào. Tạo cuộc mới để bắt đầu nhé.
          </p>
        )}
      </aside>

      <div className="flex min-h-[70vh] min-w-0 flex-col overflow-hidden rounded-3xl border border-brand-plum/10 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-brand-plum/10 p-4 sm:px-6">
          <div>
            <h2 className="font-semibold">Sakura · Trợ lý Japan Figure</h2>
            <p className="mt-1 text-xs text-brand-ink/60">
              Chỉ tư vấn từ dữ liệu local của cửa hàng
            </p>
          </div>
          <button
            className="button-secondary min-h-10 px-3 text-xs"
            disabled={!conversationId || pending || sending}
            onClick={() => void deleteConversation()}
            type="button"
          >
            Xóa cuộc trò chuyện
          </button>
        </div>

        {error ? (
          <p className="mx-4 mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="sr-only" role="status">
            {notice}
          </p>
        ) : null}
        {access === 'error' ? (
          <p className="m-4 text-sm text-red-900" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6" aria-label="Tin nhắn">
          {!conversationId ? (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <p className="font-semibold">Sẵn sàng giúp bạn chọn figure</p>
                <p className="mt-2 text-sm text-brand-ink/65">
                  Bắt đầu bằng một câu hỏi về sản phẩm hoặc cách bảo quản.
                </p>
                <button
                  className="button-primary mt-4"
                  disabled={pending}
                  onClick={() => void createConversation()}
                  type="button"
                >
                  Bắt đầu trò chuyện
                </button>
              </div>
            </div>
          ) : pending ? (
            <p className="text-sm text-brand-ink/65">Đang tải cuộc trò chuyện…</p>
          ) : messages.length === 0 ? (
            <div className="max-w-xl rounded-3xl rounded-tl-md bg-brand-cream p-4 text-sm leading-6">
              Chào bạn! Tôi có thể hỗ trợ tìm hiểu sản phẩm và thông tin cửa hàng. Cứ hỏi nhé — tôi
              sẽ nói rõ khi dữ liệu local chưa có câu trả lời.
            </div>
          ) : (
            messages.map((message) => (
              <article
                className={`max-w-3xl rounded-3xl p-4 text-sm leading-6 ${message.role === 'USER' ? 'ml-auto rounded-tr-md bg-brand-plum text-white' : 'rounded-tl-md bg-brand-cream'}`}
                key={message.id}
              >
                <p className="mb-1 text-xs font-semibold opacity-70">
                  {message.role === 'USER' ? 'Bạn' : 'Sakura'}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {message.content || (sending ? chatStatus || 'Đang tìm câu trả lời…' : '')}
                </p>
                {message.role === 'ASSISTANT' && message.sources?.length ? (
                  <div className="mt-3 border-t border-brand-plum/10 pt-3">
                    <p className="text-xs font-semibold">Nguồn tham khảo</p>
                    <ul className="mt-1 space-y-1">
                      {message.sources.map((source, index) => {
                        const href = safeSourceHref(source);
                        return (
                          <li className="text-xs" key={`${source.type}-${source.id}-${index}`}>
                            {href ? (
                              <Link className="underline" href={href}>
                                [{index + 1}] {source.title}
                              </Link>
                            ) : (
                              <span>
                                [{index + 1}] {source.title}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                {message.role === 'ASSISTANT' && !message.id.startsWith('assistant-') ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-plum/10 pt-3">
                    <span className="text-xs">Câu trả lời này hữu ích?</span>
                    {(['HELPFUL', 'NOT_HELPFUL'] as const).map((rating) => (
                      <button
                        aria-pressed={message.feedback === rating}
                        className={`rounded-full border px-3 py-1 text-xs ${message.feedback === rating ? 'border-brand-plum bg-brand-plum text-white' : 'border-brand-plum/20 hover:bg-white'}`}
                        key={rating}
                        onClick={() => void saveFeedback(message.id, rating)}
                        type="button"
                      >
                        {rating === 'HELPFUL' ? '👍 Có' : '👎 Chưa'}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))
          )}
          <div ref={tailRef} />
        </div>

        <form className="border-t border-brand-plum/10 p-3 sm:p-4" onSubmit={sendMessage}>
          <label className="sr-only" htmlFor="chat-message">
            Tin nhắn của bạn
          </label>
          <div className="flex items-end gap-2">
            <textarea
              className="filter-control min-h-12 resize-y py-3"
              disabled={!conversationId || sending || pending}
              id="chat-message"
              maxLength={500}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Nhập câu hỏi (tối đa 500 ký tự)…"
              rows={2}
              value={content}
            />
            <button
              className="button-primary shrink-0"
              disabled={!conversationId || sending || pending || !content.trim()}
              type="submit"
            >
              {sending ? 'Đang gửi…' : 'Gửi'}
            </button>
          </div>
          <p className="mt-2 text-right text-xs text-brand-ink/55">{content.length}/500</p>
        </form>
      </div>
    </section>
  );
}
