import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '../../components/site-footer';
import SiteHeader from '../../components/site-header';
import { getCatalogFacets } from '../../lib/catalog';
import type { CatalogFacets } from '../../lib/catalog';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Khám phá bộ sưu tập | Japan Figure',
  description: 'Tìm figure theo dòng sản phẩm, series, thương hiệu và năm phát hành.',
};

const discoveryPaths = [
  {
    href: '/products?newArrival=true',
    eyebrow: 'Vừa cập nhật',
    title: 'Mẫu mới về',
    description: 'Xem những lựa chọn mới được thêm vào catalog.',
    icon: '✦',
    tone: 'bg-brand-mint/60',
  },
  {
    href: '/products?preorder=true',
    eyebrow: 'Nhìn về phía trước',
    title: 'Đang đặt trước',
    description: 'Tham khảo mẫu và lịch phát hành mô phỏng.',
    icon: '◷',
    tone: 'bg-brand-rose/50',
  },
  {
    href: '/products?featured=true',
    eyebrow: 'Điểm nhấn',
    title: 'Được yêu thích',
    description: 'Khám phá các sản phẩm nổi bật trong demo.',
    icon: '♡',
    tone: 'bg-[#eee6f0]',
  },
  {
    href: '/products?saleOnly=true',
    eyebrow: 'Giá demo',
    title: 'Ưu đãi nhỏ xinh',
    description: 'Các mức giá khuyến mãi được mô phỏng trong catalog.',
    icon: '↗',
    tone: 'bg-[#f5edda]',
  },
];

function BrowseLinks({
  title,
  description,
  items,
  query,
  emptyMessage,
}: {
  title: string;
  description: string;
  items: Array<{ slug: string; name: string; productCount: number }>;
  query: string;
  emptyMessage: string;
}) {
  return (
    <section className="page-shell py-8 sm:py-10" aria-label={title}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-plum">
            Duyệt theo
          </p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-ink/65">{description}</p>
        </div>
        <Link
          className="text-sm font-semibold text-brand-plum underline underline-offset-4"
          href="/products"
        >
          Xem toàn bộ catalog
        </Link>
      </div>
      {items.length ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <li key={item.slug}>
              <Link
                className="group flex min-h-20 w-full min-w-0 items-center justify-between gap-4 rounded-2xl border border-brand-plum/10 bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:border-brand-plum/30 hover:shadow-soft sm:px-5"
                href={`/products?${query}=${encodeURIComponent(item.slug)}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-cream text-sm font-semibold text-brand-plum"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate font-semibold group-hover:text-brand-plum">
                    {item.name}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-brand-ink/55">{item.productCount} mẫu</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-brand-plum/20 bg-white/70 p-5 text-sm text-brand-ink/65">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

export default async function CollectionsPage() {
  let facets: CatalogFacets | null = null;
  let unavailable = false;

  try {
    facets = await getCatalogFacets();
  } catch (error) {
    console.error('Unable to load collection discovery.', error);
    unavailable = true;
  }

  const categories = [...(facets?.categories ?? [])].sort(
    (a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name),
  );
  const brands = [...(facets?.brands ?? [])]
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name))
    .slice(0, 12);
  const series = [...(facets?.series ?? [])]
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name))
    .slice(0, 12);
  const years = (facets?.releaseYears ?? []).map(({ year, productCount }) => ({
    slug: String(year),
    name: String(year),
    productCount,
  }));

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
        <section className="hero-grid border-b border-brand-plum/10">
          <div className="page-shell py-10 sm:py-16">
            <nav className="mb-8 text-xs text-brand-ink/60" aria-label="Breadcrumb">
              <Link className="hover:text-brand-plum" href="/">
                Trang chủ
              </Link>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span aria-current="page">Khám phá</span>
            </nav>
            <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-plum">
                  <span aria-hidden="true">✿</span> Một lối đi cho mỗi bộ sưu tập
                </p>
                <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
                  Bắt đầu từ điều <span className="text-brand-plum">bạn yêu thích.</span>
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-brand-ink/70 sm:text-base">
                  Lọc catalog theo phong cách, series, hãng sản xuất hoặc năm phát hành — chọn cách
                  khám phá phù hợp với chiếc kệ của bạn.
                </p>
              </div>
              <Link className="button-primary w-fit" href="/products">
                Mở toàn bộ catalog <span aria-hidden="true">→</span>
              </Link>
            </div>
            <p className="mt-6 text-xs leading-5 text-brand-ink/55">
              Catalog học tập: số lượng, giá và lịch phát hành là dữ liệu mô phỏng, không đại diện
              cho hàng hóa hay giao dịch thật.
            </p>
          </div>
        </section>

        <section className="page-shell py-8 sm:py-10" aria-labelledby="discovery-paths-title">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-plum">
              Chọn nhanh
            </p>
            <h2 className="mt-2 text-2xl font-semibold sm:text-3xl" id="discovery-paths-title">
              Bạn đang tìm cảm hứng nào?
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {discoveryPaths.map((path) => (
              <Link
                className={`group flex min-h-48 flex-col rounded-3xl border border-brand-plum/10 p-5 transition hover:-translate-y-1 hover:shadow-soft ${path.tone}`}
                href={path.href}
                key={path.href}
              >
                <span
                  aria-hidden="true"
                  className="grid size-11 place-items-center rounded-2xl bg-white/80 text-xl text-brand-plum"
                >
                  {path.icon}
                </span>
                <span className="mt-5 text-xs font-semibold uppercase tracking-[0.15em] text-brand-plum/75">
                  {path.eyebrow}
                </span>
                <span className="mt-1 text-lg font-semibold group-hover:text-brand-plum">
                  {path.title}
                </span>
                <span className="mt-2 text-sm leading-5 text-brand-ink/65">{path.description}</span>
              </Link>
            ))}
          </div>
        </section>

        {unavailable ? (
          <section className="page-shell py-6" role="alert">
            <p className="rounded-2xl border border-amber-900/10 bg-white p-5 text-sm text-brand-ink/75">
              Chưa tải được bộ lọc catalog. Bạn vẫn có thể{' '}
              <Link className="font-semibold text-brand-plum underline" href="/products">
                mở toàn bộ sản phẩm
              </Link>{' '}
              hoặc thử lại sau.
            </p>
          </section>
        ) : null}

        <BrowseLinks
          title="Chọn theo dòng figure"
          description="Từ mẫu dễ bắt đầu sưu tầm đến figure tạo hình chi tiết."
          items={categories}
          query="category"
          emptyMessage="Chưa có dòng sản phẩm được xuất bản."
        />
        <div className="bg-white/55">
          <BrowseLinks
            title="Gặp lại series bạn yêu"
            description="Đi thẳng tới những thế giới và nhân vật bạn đang theo dõi."
            items={series}
            query="series"
            emptyMessage="Chưa có series được xuất bản."
          />
        </div>
        <BrowseLinks
          title="Khám phá nhà sản xuất"
          description="Duyệt theo thương hiệu đang có sản phẩm trong catalog."
          items={brands}
          query="brand"
          emptyMessage="Chưa có nhà sản xuất được xuất bản."
        />
        {years.length ? (
          <section className="page-shell py-8 sm:py-10" aria-labelledby="release-years-title">
            <div className="rounded-[2rem] bg-brand-plum p-6 text-white sm:p-9">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Lịch phát hành trong catalog
              </p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl" id="release-years-title">
                Bạn đang ngóng năm nào?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                Chọn năm để xem các mẫu có ngày phát hành tương ứng trong dữ liệu demo.
              </p>
              <ul className="mt-5 flex flex-wrap gap-3">
                {years.map((year) => (
                  <li key={year.slug}>
                    <Link
                      className="inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-5 text-sm font-semibold text-brand-plum transition hover:bg-brand-mint"
                      href={`/products?releaseYear=${year.slug}`}
                    >
                      {year.name}
                      <span className="text-xs font-normal text-brand-ink/60">
                        {year.productCount} mẫu
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="page-shell py-8 sm:py-10" aria-labelledby="help-discovery-title">
          <div className="flex flex-col gap-4 rounded-3xl border border-brand-plum/10 bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-plum">
                Lần đầu ghé thăm?
              </p>
              <h2 className="mt-2 text-xl font-semibold" id="help-discovery-title">
                Tìm hiểu cách demo hoạt động
              </h2>
              <p className="mt-2 text-sm leading-6 text-brand-ink/65">
                Đọc hướng dẫn về giỏ hàng, đơn mô phỏng, preorder và các giới hạn của dự án.
              </p>
            </div>
            <Link className="button-secondary shrink-0" href="/help">
              Hướng dẫn &amp; câu hỏi thường gặp
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
