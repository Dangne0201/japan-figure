import Image from 'next/image';
import Link from 'next/link';
import { formatVnd, productImageUrl, type ProductCard as Product } from '../lib/catalog';
import AddToCartButton from './add-to-cart-button';
import WishlistButton from './wishlist-button';

export default function ProductCard({ product }: { product: Product }) {
  const image = product.images[0];
  return (
    <article className="group min-w-0">
      <Link
        className="block overflow-hidden rounded-3xl border border-brand-plum/10 bg-white"
        href={`/products/${product.slug}`}
        aria-label={`Xem ${product.name}`}
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-brand-rose/20">
          <Image
            src={productImageUrl(product.slug)}
            alt={image?.altText ?? `Hình minh họa ${product.name}`}
            fill
            unoptimized
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
          />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {product.isPreorder && <span className="badge">Đặt trước</span>}
            {!product.isPreorder && product.stock === 0 && (
              <span className="badge badge-muted">Tạm hết hàng</span>
            )}
            {product.salePriceVnd && <span className="badge badge-sale">Ưu đãi</span>}
          </div>
        </div>
      </Link>
      <div className="px-1 pt-3">
        <p className="text-xs font-medium text-brand-plum">{product.series.name}</p>
        <Link
          href={`/products/${product.slug}`}
          className="mt-1 line-clamp-2 min-h-12 font-semibold leading-6 text-brand-ink hover:text-brand-plum"
        >
          {product.name}
        </Link>
        <p className="mt-2 text-sm font-bold text-brand-ink">
          {formatVnd(product.salePriceVnd ?? product.priceVnd)}
          {product.salePriceVnd && (
            <span className="ml-2 text-xs font-normal text-brand-ink/50 line-through">
              {formatVnd(product.priceVnd)}
            </span>
          )}
        </p>
        {product.isPreorder && product.preorderDepositVnd && (
          <p className="mt-1 text-xs text-brand-ink/65">
            Cọc dự kiến {formatVnd(product.preorderDepositVnd)}
          </p>
        )}
        {!product.isPreorder ? (
          <AddToCartButton
            compact
            disabled={product.stock === 0}
            variantId={product.variants.find((variant) => variant.stockAvailable > 0)?.id}
          />
        ) : null}
        <WishlistButton productSlug={product.slug} />
      </div>
    </article>
  );
}
