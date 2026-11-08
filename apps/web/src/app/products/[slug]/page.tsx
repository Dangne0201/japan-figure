import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '../../../components/product-card';
import SiteFooter from '../../../components/site-footer';
import SiteHeader from '../../../components/site-header';
import { formatVnd, getProduct, productImageUrl } from '../../../lib/catalog';
import AddToCartButton from '../../../components/add-to-cart-button';
import WishlistButton from '../../../components/wishlist-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  try {
    const { slug } = await params;
    const { product } = await getProduct(slug);
    return {
      title: `${product.characterName} | Japan Figure`,
      description: product.description,
      openGraph: {
        title: product.name,
        description: product.description,
        images: [productImageUrl(product.slug)],
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP 404')) {
      return { title: 'Không tìm thấy sản phẩm | Japan Figure' };
    }
    throw error;
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let result;
  try {
    result = await getProduct(slug);
  } catch (error) {
    if (error instanceof Error && error.message.includes('HTTP 404')) notFound();
    console.error(`Unable to load product "${slug}".`, error);
    return (
      <>
        <SiteHeader />
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
          <section className="page-shell py-16" role="alert">
            <h1 className="text-3xl font-semibold">Chi tiết sản phẩm chưa tải được</h1>
            <p className="mt-3 text-sm text-brand-ink/70">
              Hãy kiểm tra API/database đang hoạt động rồi thử lại.
            </p>
          </section>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { product, related } = result;
  const image = product.images[0];
  const category = product.categories[0]?.name ?? 'Figure';

  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
        <div className="page-shell py-6 sm:py-10">
          <nav className="mb-6 text-xs text-brand-ink/60" aria-label="Breadcrumb">
            <Link className="hover:text-brand-plum" href="/">
              Trang chủ
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <Link className="hover:text-brand-plum" href="/products">
              Danh mục
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span aria-current="page">{product.characterName}</span>
          </nav>
          <div className="grid gap-8 md:grid-cols-2 md:gap-12">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-xl overflow-hidden rounded-[2rem] border border-brand-plum/10 bg-white">
              <Image
                src={productImageUrl(product.slug)}
                alt={image?.altText ?? `Hình minh họa ${product.name}`}
                fill
                priority
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <section>
              <p className="text-sm font-semibold text-brand-plum">{product.series.name}</p>
              <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-4 text-2xl font-bold">
                {formatVnd(product.salePriceVnd ?? product.priceVnd)}
                {product.salePriceVnd && (
                  <span className="ml-3 text-base font-normal text-brand-ink/50 line-through">
                    {formatVnd(product.priceVnd)}
                  </span>
                )}
              </p>
              <p className="mt-5 leading-7 text-brand-ink/75">{product.description}</p>
              {!product.isPreorder ? (
                <AddToCartButton
                  disabled={product.stock === 0}
                  variantId={product.variants.find((variant) => variant.stockAvailable > 0)?.id}
                />
              ) : null}
              <WishlistButton productSlug={product.slug} />
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="badge">{category}</span>
                {product.isPreorder && <span className="badge">Mô phỏng: đặt trước</span>}
                {!product.isPreorder && product.stock === 0 && (
                  <span className="badge badge-muted">Tạm hết hàng</span>
                )}
              </div>
              <dl className="mt-7 grid grid-cols-2 gap-x-4 gap-y-4 rounded-3xl bg-white p-5 text-sm">
                <div>
                  <dt className="text-brand-ink/55">Thương hiệu</dt>
                  <dd className="mt-1 font-semibold">{product.brand.name}</dd>
                </div>
                <div>
                  <dt className="text-brand-ink/55">Kích thước</dt>
                  <dd className="mt-1 font-semibold">
                    {product.scale ?? 'Prize / không theo tỉ lệ'}
                  </dd>
                </div>
                <div>
                  <dt className="text-brand-ink/55">Chất liệu</dt>
                  <dd className="mt-1 font-semibold">{product.material}</dd>
                </div>
                <div>
                  <dt className="text-brand-ink/55">Ngày phát hành dự kiến</dt>
                  <dd className="mt-1 font-semibold">{product.releaseDate ?? 'Đang cập nhật'}</dd>
                </div>
                <div>
                  <dt className="text-brand-ink/55">Mã tham khảo</dt>
                  <dd className="mt-1 font-semibold">{product.janCode} · demo</dd>
                </div>
                <div>
                  <dt className="text-brand-ink/55">Tồn kho mô phỏng</dt>
                  <dd className="mt-1 font-semibold">
                    {product.isPreorder
                      ? 'Đang nhận đặt trước'
                      : product.stock > 0
                        ? `Còn ${product.stock} sản phẩm`
                        : 'Tạm hết hàng'}
                  </dd>
                </div>
              </dl>
              {product.isPreorder && product.preorderDepositVnd && (
                <p className="mt-4 rounded-2xl bg-brand-mint/50 p-4 text-sm">
                  Tiền cọc tham khảo: <strong>{formatVnd(product.preorderDepositVnd)}</strong>. Đây
                  chỉ là dữ liệu mô phỏng, không phát sinh thanh toán.
                </p>
              )}
              <p className="mt-5 text-xs leading-5 text-brand-ink/55">
                Hình ảnh là placeholder tự tạo. Giá, ngày phát hành và tồn kho trong demo không đại
                diện cho thông tin bán hàng thật.
              </p>
            </section>
          </div>
        </div>
        <section className="page-shell py-8" aria-labelledby="reviews-title">
          <div className="rounded-3xl bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold" id="reviews-title">
              Đánh giá đã duyệt
              {result.averageRating !== null ? (
                <span className="ml-2 text-sm font-medium text-brand-plum">
                  ★ {result.averageRating.toFixed(1)} / 5
                </span>
              ) : null}
            </h2>
            {result.reviews.length ? (
              <ul className="mt-4 divide-y divide-brand-plum/10">
                {result.reviews.map((review, index) => (
                  <li className="py-4 first:pt-0 last:pb-0" key={`${review.createdAt}-${index}`}>
                    <p className="font-semibold">
                      {'★'.repeat(review.rating)}{' '}
                      <span className="text-sm font-normal text-brand-ink/60">
                        {review.user.name}
                      </span>
                    </p>
                    <p className="mt-2 text-sm leading-6">{review.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-brand-ink/65">
                Chưa có đánh giá được duyệt. Chỉ khách đã nhận hàng mới có thể gửi đánh giá.
              </p>
            )}
          </div>
        </section>
        {related.length > 0 && (
          <section className="page-shell py-10" aria-labelledby="related-title">
            <h2 id="related-title" className="mb-5 text-2xl font-semibold">
              Cùng series
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
              {related.map((item) => (
                <ProductCard key={item.slug} product={item} />
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
