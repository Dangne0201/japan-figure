import Link from 'next/link';
import SearchBar from './search-bar';

export default function SiteHeader({ initialQuery = '' }: { initialQuery?: string }) {
  return (
    <header className="border-b border-brand-plum/10 bg-brand-cream">
      <div className="page-shell flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2 sm:min-h-20 sm:gap-y-3 sm:py-3">
        <Link
          className="order-1 flex w-full shrink-0 items-center gap-2 sm:w-auto sm:gap-3"
          href="/"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-brand-plum text-lg text-white sm:size-11 sm:rounded-2xl sm:text-xl">
            花
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight sm:text-lg">
              JAPAN FIGURE
            </span>
            <span className="hidden text-[10px] tracking-[0.2em] text-brand-plum sm:block">
              COLLECT WITH JOY
            </span>
          </span>
        </Link>
        <nav
          className="order-3 hidden items-center gap-5 overflow-x-auto text-sm font-medium sm:flex"
          aria-label="Danh mục chính"
        >
          <Link className="whitespace-nowrap hover:text-brand-plum" href="/products">
            Tất cả figure
          </Link>
          <Link className="whitespace-nowrap hover:text-brand-plum" href="/products?preorder=true">
            Đặt trước
          </Link>
          <Link className="whitespace-nowrap hover:text-brand-plum" href="/products?featured=true">
            Nổi bật
          </Link>
          <Link className="whitespace-nowrap hover:text-brand-plum" href="/chat">
            Tư vấn
          </Link>
        </nav>
        <div className="order-2 flex w-full items-center gap-2 sm:order-3 sm:w-auto sm:gap-3">
          <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <SearchBar key={initialQuery} initialQuery={initialQuery} />
          </div>
          <Link
            className="hidden whitespace-nowrap text-sm font-semibold text-brand-plum sm:block"
            href="/cart"
          >
            Giỏ hàng
          </Link>
          <Link
            className="hidden whitespace-nowrap text-sm font-semibold text-brand-plum sm:block"
            href="/account"
          >
            Tài khoản
          </Link>
        </div>
      </div>
      <div className="border-t border-brand-plum/5 bg-white/60 py-1 text-center text-[10px] text-brand-ink/75 sm:text-[11px]">
        Dự án mô phỏng · Không nhận giao dịch thật
      </div>
    </header>
  );
}
