import Link from 'next/link';
import SearchBar from './search-bar';

export default function SiteHeader({ initialQuery = '' }: { initialQuery?: string }) {
  return (
    <header className="border-b border-brand-plum/10 bg-brand-cream">
      <div className="page-shell flex min-h-20 flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3">
        <Link className="flex shrink-0 items-center gap-3" href="/">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-plum text-xl text-white">
            花
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight">JAPAN FIGURE</span>
            <span className="block text-[10px] tracking-[0.2em] text-brand-plum">
              COLLECT WITH JOY
            </span>
          </span>
        </Link>
        <nav
          className="order-3 flex w-full items-center gap-5 overflow-x-auto text-sm font-medium sm:order-2 sm:w-auto"
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
        <div className="order-2 flex w-full items-center gap-3 sm:order-3 sm:w-auto">
          <div className="min-w-0 flex-1">
            <SearchBar key={initialQuery} initialQuery={initialQuery} />
          </div>
          <Link className="whitespace-nowrap text-sm font-semibold text-brand-plum" href="/cart">
            Giỏ hàng
          </Link>
          <Link className="whitespace-nowrap text-sm font-semibold text-brand-plum" href="/account">
            Tài khoản
          </Link>
        </div>
      </div>
      <div className="border-t border-brand-plum/5 bg-white/60 py-1 text-center text-[11px] text-brand-ink/75">
        Dự án mô phỏng phục vụ học tập · Không nhận giao dịch thật
      </div>
    </header>
  );
}
