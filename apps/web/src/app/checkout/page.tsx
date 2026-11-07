import type { Metadata } from 'next';
import CheckoutPage from '../../components/checkout-page';
import SiteFooter from '../../components/site-footer';
import SiteHeader from '../../components/site-header';

export const metadata: Metadata = {
  title: 'Đặt hàng mô phỏng | Japan Figure',
  description: 'Xem phí giao hàng, ưu đãi và điểm tích lũy trong luồng checkout mô phỏng.',
};

export default function CheckoutRoute() {
  return (
    <main className="min-h-screen bg-brand-cream">
      <SiteHeader />
      <CheckoutPage />
      <SiteFooter />
    </main>
  );
}
