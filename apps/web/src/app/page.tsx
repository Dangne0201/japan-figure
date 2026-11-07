import Link from 'next/link';
import Image from 'next/image';
import ProductSection from '../components/product-section';
import SiteFooter from '../components/site-footer';
import SiteHeader from '../components/site-header';
import {
  getCatalogFacets,
  getCatalogHome,
  type CatalogFacets,
  type CatalogHome,
} from '../lib/catalog';

export const dynamic = 'force-dynamic';

const categoryLinks = [
  {
    slug: 'prize-figure',
    name: 'Prize Figure',
    description: 'Những mẫu figure dễ bắt đầu sưu tầm.',
  },
  {
    slug: 'scale-figure',
    name: 'Scale Figure',
    description: 'Tạo hình tỉ mỉ, dành cho góc trưng bày.',
  },
  { slug: 'action-figure', name: 'Action Figure', description: 'Linh hoạt tạo dáng theo ý bạn.' },
  { slug: 'chibi-figure', name: 'Chibi Figure', description: 'Nhỏ xinh, biểu cảm và đầy cá tính.' },
];

export default async function HomePage() {
  let home: CatalogHome | null = null;
  let categories: CatalogFacets['categories'] = categoryLinks.map(({ slug, name }) => ({
    slug,
    name,
  }));
  let unavailable = false;
  try {
    const [products, facets] = await Promise.all([getCatalogHome(), getCatalogFacets()]);
    home = products;
    categories = facets.categories;
  } catch (error) {
    console.error('Unable to load storefront catalog.', error);
    unavailable = true;
  }

  return (
    <main className="min-h-screen bg-brand-cream">
      <SiteHeader />
      {home?.banners.length ? (
        <section className="page-shell pt-6 sm:pt-8" aria-label="Ưu đãi đang diễn ra">
          <div className="grid gap-4 sm:grid-cols-2">
            {home.banners.map((banner) => (
              <Link
                key={banner.id}
                href={banner.href}
                className="group relative isolate flex min-h-44 items-end overflow-hidden rounded-3xl bg-brand-plum p-5 text-white sm:min-h-56 sm:p-7"
              >
                <Image
                  src={banner.imageUrl}
                  alt=""
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="-z-10 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-brand-ink/80 via-brand-ink/15 to-transparent" />
                <div>
                  <h2 className="text-xl font-semibold sm:text-2xl">{banner.title}</h2>
                  {banner.description ? (
                    <p className="mt-1 max-w-prose text-sm text-white/85">{banner.description}</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      <section className="hero-grid">
        <div className="page-shell grid gap-8 py-12 sm:py-20 md:grid-cols-[1.05fr_0.95fr] md:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-mint/60 px-4 py-2 text-sm font-medium">
              <span aria-hidden="true">✦</span> Một góc nhỏ Nhật Bản, dành cho bộ sưu tập của bạn
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Tìm nhân vật khiến bạn <span className="text-brand-plum">mỉm cười.</span>
            </h1>
            <p className="mt-5 max-w-xl leading-7 text-brand-ink/70">
              Khám phá figure anime từ những series bạn yêu thích — chọn món tiếp theo cho chiếc kệ
              sưu tập thật vui.
            </p>
            <Link className="button-primary mt-7" href="/products">
              Khám phá bộ sưu tập <span aria-hidden="true">→</span>
            </Link>
            <p className="mt-4 text-xs leading-5 text-brand-ink/55">
              Dự án minh họa phục vụ học tập. Giá, tồn kho và lịch phát hành chỉ là dữ liệu mô
              phỏng; không nhận giao dịch thật.
            </p>
          </div>
          <div className="relative mx-auto flex min-h-72 w-full max-w-md items-center justify-center sm:min-h-96">
            <div className="absolute size-64 rounded-full bg-brand-rose/45 blur-3xl sm:size-80" />
            <div className="relative w-full rounded-[2rem] border border-white bg-white/80 p-6 shadow-soft sm:p-8">
              <div className="flex items-center justify-between text-sm font-semibold text-brand-plum">
                <span>COLLECT WITH JOY</span>
                <span className="rounded-full bg-brand-mint/60 px-3 py-1 text-xs">2026</span>
              </div>
              <div className="my-7 grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl bg-gradient-to-br from-brand-rose/60 via-brand-cream to-brand-mint/70">
                <div className="text-center">
                  <span className="block text-8xl" aria-hidden="true">
                    ✿
                  </span>
                  <span className="mt-3 block text-sm font-medium text-brand-plum">
                    Your collection starts here
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-brand-plum/75">Khám phá</p>
                <p className="mt-1 text-xl font-semibold">Một niềm vui bé xinh</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell py-10 sm:py-14" aria-labelledby="category-title">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-plum">
            Chọn theo phong cách
          </p>
          <h2 id="category-title" className="mt-2 text-2xl font-semibold sm:text-3xl">
            Bạn thích dòng figure nào?
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
          {categoryLinks.map((category, index) => {
            const name =
              categories.find((item) => item.slug === category.slug)?.name ?? category.name;
            return (
              <Link
                key={category.slug}
                href={`/products?category=${category.slug}`}
                className="category-tile"
              >
                <span className="text-3xl" aria-hidden="true">
                  {['✿', '✧', '◇', '♡'][index]}
                </span>
                <span className="mt-4 block font-semibold">{name}</span>
                <span className="mt-1 block text-xs leading-5 text-brand-ink/60">
                  {category.description}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {unavailable || !home ? (
        <section className="page-shell py-10" role="status">
          <div className="rounded-3xl border border-amber-900/10 bg-white p-7">
            <h2 className="text-xl font-semibold">Danh mục đang tạm thời chưa tải được</h2>
            <p className="mt-2 text-sm leading-6 text-brand-ink/70">
              Hệ thống chưa kết nối được catalog. Bạn có thể thử tải lại hoặc mở danh mục sản phẩm.
            </p>
            <Link className="button-primary mt-4" href="/products">
              Thử mở danh mục
            </Link>
          </div>
        </section>
      ) : (
        <>
          <ProductSection
            title="Được yêu thích"
            description="Một vài gương mặt nổi bật trong bộ sưu tập."
            products={home.featured}
            href="/products?featured=true"
          />
          <ProductSection
            title="Mẫu mới về"
            description="Những lựa chọn mới được cập nhật gần đây."
            products={home.newArrivals}
            href="/products?newArrival=true"
          />
          <ProductSection
            title="Đặt trước"
            description="Mẫu mô phỏng đang mở đặt trước — cọc chỉ mang tính tham khảo."
            products={home.preorders}
            href="/products?preorder=true"
          />
          <ProductSection
            title="Ưu đãi nhỏ xinh"
            description="Giá ưu đãi trong dữ liệu mô phỏng của cửa hàng."
            products={home.sales}
            href="/products?saleOnly=true"
          />
        </>
      )}
      <SiteFooter />
    </main>
  );
}
