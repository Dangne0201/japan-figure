import Link from 'next/link';

export default function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-brand-plum/10 bg-white/70">
      <div className="page-shell flex flex-col gap-3 py-8 text-xs text-brand-ink/75 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 Japan Figure · Dự án mô phỏng phục vụ học tập</span>
        <div className="flex gap-4">
          <Link className="hover:text-brand-plum" href="/products">
            Danh mục
          </Link>
          <Link className="hover:text-brand-plum" href="/api/docs">
            Tài liệu API
          </Link>
        </div>
        <span>Không liên kết với thương hiệu hay hãng phim nào</span>
      </div>
    </footer>
  );
}
