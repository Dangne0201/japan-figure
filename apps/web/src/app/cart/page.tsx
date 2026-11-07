import type { Metadata } from 'next';
import CartPage from '../../components/cart-page';
import SiteFooter from '../../components/site-footer';
import SiteHeader from '../../components/site-header';

export const metadata: Metadata = {
  title: 'Giỏ hàng | Japan Figure',
  description: 'Quản lý các figure bạn muốn đặt trong cửa hàng mô phỏng.',
};

export default function CartRoute() {
  return (
    <main className="min-h-screen bg-brand-cream">
      <SiteHeader />
      <CartPage />
      <SiteFooter />
    </main>
  );
}
