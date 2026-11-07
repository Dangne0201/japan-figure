import Link from 'next/link';

interface ApiHealth {
  status?: string;
  checks?: {
    database?: { status?: string };
    redis?: { status?: string };
    ollama?: { status?: string; detail?: string };
  };
}

async function getApiHealth(): Promise<ApiHealth | null> {
  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';
  try {
    const response = await fetch(new URL('/api/health', apiUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    });
    const health = (await response.json()) as ApiHealth;
    return health;
  } catch {
    return null;
  }
}

function statusLabel(status?: string, optional = false): string {
  if (status === 'up' || status === 'ok') return 'Đã kết nối';
  if (status === 'degraded') {
    return optional ? 'Chưa bật (không bắt buộc)' : 'Đang gặp sự cố';
  }
  return 'Chưa kết nối';
}

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getApiHealth();
  const checks = health?.checks;

  return (
    <main className="min-h-screen overflow-hidden bg-brand-cream">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link className="flex items-center gap-3" href="/" aria-label="Japan Figure trang chủ">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-plum text-xl text-white">
            花
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight">JAPAN FIGURE</span>
            <span className="block text-xs tracking-[0.2em] text-brand-plum">COLLECT WITH JOY</span>
          </span>
        </Link>
        <span className="hidden rounded-full border border-brand-rose/70 bg-white/70 px-4 py-2 text-sm text-brand-ink sm:inline-flex">
          Cửa hàng mô phỏng · Chưa mở bán
        </span>
      </header>

      <section className="hero-grid mx-auto grid max-w-6xl gap-10 px-5 pb-12 pt-8 sm:px-8 sm:pb-20 sm:pt-14 md:grid-cols-[1.1fr_0.9fr] md:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-mint/60 px-4 py-2 text-sm font-medium">
            <span aria-hidden="true">✦</span> Thế giới figure, chọn theo cách của bạn
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Một góc nhỏ <span className="text-brand-plum">Nhật Bản</span> dành cho bộ sưu tập của
            bạn.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-brand-ink/75 sm:text-lg">
            Japan Figure là dự án học tập mô phỏng cửa hàng figure anime — tinh tế, thân thiện và
            được thiết kế để dùng dễ dàng trên cả điện thoại lẫn máy tính.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-plum px-6 font-semibold text-white transition hover:bg-brand-ink"
              href="#ket-noi"
            >
              Xem trạng thái hệ thống
            </a>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand-plum/25 bg-white/80 px-6 font-semibold text-brand-ink"
              href="/api/docs"
            >
              Tài liệu API
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-brand-ink/60">
            Dự án minh họa phục vụ học tập. Không liên kết với thương hiệu hay hãng phim nào và
            không nhận giao dịch thật.
          </p>
        </div>

        <div className="relative mx-auto flex min-h-72 w-full max-w-md items-center justify-center sm:min-h-96">
          <div className="absolute size-64 rounded-full bg-brand-rose/40 blur-3xl sm:size-80" />
          <div className="relative w-full rounded-[2rem] border border-white bg-white/80 p-6 shadow-soft sm:p-8">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide text-brand-plum">
                FIGURE JOURNAL
              </span>
              <span className="rounded-full bg-brand-mint/60 px-3 py-1 text-xs">01 / 04</span>
            </div>
            <div className="my-8 grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand-rose/50 via-brand-cream to-brand-mint/70">
              <div className="text-center">
                <span className="block text-7xl" aria-hidden="true">
                  ✿
                </span>
                <span className="mt-3 block text-sm font-medium text-brand-plum">
                  Your collection starts here
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-plum/75">Khám phá</p>
                <p className="mt-1 text-xl font-semibold">Một niềm vui bé xinh</p>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-cream text-xl">
                ↗
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="ket-noi" className="border-y border-brand-plum/10 bg-white/70">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-plum">
              Kiểm tra Phase 1
            </p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Kết nối web → API → dịch vụ</h2>
            <p className="mt-3 leading-7 text-brand-ink/70">
              Trang này lấy trạng thái từ API NestJS; API kiểm tra kết nối database, Redis và Ollama
              trên máy chủ.
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Web', 'up'],
              ['API', health ? health.status : 'down'],
              ['PostgreSQL', checks?.database?.status],
              ['Redis', checks?.redis?.status],
            ].map(([label, status]) => (
              <div
                className="rounded-2xl border border-brand-plum/10 bg-brand-cream p-4"
                key={label}
              >
                <p className="text-sm text-brand-ink/65">{label}</p>
                <p
                  className={`mt-2 font-semibold ${status === 'up' || status === 'ok' ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                  {statusLabel(status)}
                </p>
              </div>
            ))}
          </div>
          {checks?.ollama?.status !== undefined && (
            <p className="mt-4 text-sm text-brand-ink/65">
              Ollama: {statusLabel(checks.ollama.status, true)}. Chatbot sẽ được triển khai ở phase
              sau.
            </p>
          )}
          {!health && (
            <p className="mt-4 text-sm text-amber-800" role="status">
              Chưa kết nối được API. Kiểm tra trạng thái các container và thử tải lại trang.
            </p>
          )}
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-7 text-xs text-brand-ink/60 sm:flex-row sm:justify-between sm:px-8">
        <span>© 2026 Japan Figure · Dự án mô phỏng phục vụ học tập</span>
        <span>Thiết kế mobile-first · Nội dung giao diện bằng tiếng Việt</span>
      </footer>
    </main>
  );
}
