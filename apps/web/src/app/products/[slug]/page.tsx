import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '../../../components/product-card';
import SiteFooter from '../../../components/site-footer';
import SiteHeader from '../../../components/site-header';
import { formatVnd, getProduct, productImageUrl } from '../../../lib/catalog';
import AddToCartButton from '../../../components/add-to-cart-button';
import WishlistButton from '../../../components/wishlist-button';
import ProductGallery from '../../../components/product-gallery';

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
            <ProductGallery
              slug={product.slug}
              primaryUrl={productImageUrl(product.slug)}
              alt={image?.altText ?? `Hình minh họa ${product.name}`}
            />
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
                  showQuantity
                  maxQuantity={Math.min(
                    99,
                    product.variants.find((variant) => variant.stockAvailable > 0)
                      ?.stockAvailable ?? 1,
                  )}
                  buyNow
                />
              ) : null}
              <WishlistButton productSlug={product.slug} />
              <nav className="mt-6 flex flex-wrap gap-2" aria-label="Duyệt sản phẩm liên quan">
                <Link
                  className="badge transition hover:bg-brand-plum hover:text-white"
                  href={`/products?category=${encodeURIComponent(product.categories[0]?.slug ?? '')}`}
                >
                  {category}
                </Link>
                <Link
                  className="badge transition hover:bg-brand-plum hover:text-white"
                  href={`/products?brand=${encodeURIComponent(product.brand.slug)}`}
                >
                  {product.brand.name}
                </Link>
                <Link
                  className="badge transition hover:bg-brand-plum hover:text-white"
                  href={`/products?series=${encodeURIComponent(product.series.slug)}`}
                >
                  {product.series.name}
                </Link>
                {product.isPreorder && <span className="badge">Mô phỏng: đặt trước</span>}
                {!product.isPreorder && product.stock === 0 && (
                  <span className="badge badge-muted">Tạm hết hàng</span>
                )}
              </nav>
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
              {product.isPreorder ? (
                <section
                  aria-labelledby="preorder-info-title"
                  className="mt-5 rounded-2xl border border-brand-plum/10 bg-brand-mint/40 p-4"
                >
                  <h2 className="font-semibold" id="preorder-info-title">
                    Thông tin đặt trước mô phỏng
                  </h2>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-brand-ink/65">Giá tham khảo</dt>
                      <dd className="font-semibold">
                        {formatVnd(product.salePriceVnd ?? product.priceVnd)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-brand-ink/65">Cọc dự kiến</dt>
                      <dd className="font-semibold">
                        {product.preorderDepositVnd
                          ? formatVnd(product.preorderDepositVnd)
                          : 'Chưa có dữ liệu'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-brand-ink/65">Phần còn lại tham khảo</dt>
                      <dd className="font-semibold">
                        {product.preorderDepositVnd
                          ? formatVnd(
                              Math.max(
                                0,
                                (product.salePriceVnd ?? product.priceVnd) -
                                  product.preorderDepositVnd,
                              ),
                            )
                          : 'Chưa có dữ liệu'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-brand-ink/65">Ngày phát hành dự kiến</dt>
                      <dd className="font-semibold">
                        {product.releaseDate
                          ? new Date(`${product.releaseDate}T00:00:00Z`).toLocaleDateString(
                              'vi-VN',
                              { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' },
                            )
                          : 'Đang cập nhật'}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-xs leading-5 text-brand-ink/70">
                    Giá, cọc, phần còn lại và lịch phát hành chỉ là dữ liệu học tập, không phải báo
                    giá hay yêu cầu thanh toán thật.
                  </p>
                </section>
              ) : null}
              <p className="mt-5 text-xs leading-5 text-brand-ink/55">
                Hình ảnh là placeholder tự tạo hoặc ảnh local do chủ dự án cung cấp. Giá, ngày phát
                hành và tồn kho trong demo không đại diện cho thông tin bán hàng thật.
              </p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-brand-plum underline"
                href="/help"
              >
                Xem hướng dẫn mua hàng và câu hỏi thường gặp
              </Link>
            </section>
          </div>
        </div>
        <section className="page-shell py-8" aria-labelledby="reviews-title">
          <div className="rounded-3xl bg-white p-5 sm:p-7">
            <h2 className="text-xl font-semibold" id="reviews-title">
              Đánh giá đã duyệt
              {result.averageRating !== null ? (
                <span className="ml-2 text-sm font-medium text-brand-plum">
                  ★ {result.averageRating.toFixed(1)} / 5 · {product.reviewCount} đánh giá đã duyệt
                </span>
              ) : (
                <span className="ml-2 text-sm font-medium text-brand-ink/60">
                  Chưa có đánh giá đã duyệt
                </span>
              )}
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
