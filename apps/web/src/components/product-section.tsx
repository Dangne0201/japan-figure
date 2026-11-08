import Link from 'next/link';
import type { ProductCard as Product } from '../lib/catalog';
import ProductCard from './product-card';

export default function ProductSection({
  title,
  description,
  products,
  href,
}: {
  title: string;
  description: string;
  products: Product[];
  href: string;
}) {
  return (
    <section
      className="page-shell py-10 sm:py-14"
      aria-labelledby={`section-${href.replaceAll('/', '-')}`}
    >
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2
            id={`section-${href.replaceAll('/', '-')}`}
            className="text-2xl font-semibold sm:text-3xl"
          >
            {title}
          </h2>
          <p className="mt-2 text-sm text-brand-ink/75">{description}</p>
        </div>
        <Link
          className="hidden shrink-0 text-sm font-semibold text-brand-plum hover:underline sm:block"
          href={href}
        >
          Xem tất cả <span aria-hidden="true">→</span>
        </Link>
      </div>
      {products.length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/80 p-6 text-sm text-brand-ink/70">
          Mục này đang được cập nhật. Bạn có thể xem toàn bộ danh mục sản phẩm.
        </p>
      )}
      <Link
        className="mt-5 inline-flex font-semibold text-brand-plum hover:underline sm:hidden"
        href={href}
      >
        Xem tất cả sản phẩm →
      </Link>
    </section>
  );
}
