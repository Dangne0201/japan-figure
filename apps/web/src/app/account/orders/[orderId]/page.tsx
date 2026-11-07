import OrderDetailPage from '../../../../components/order-detail-page';
import SiteFooter from '../../../../components/site-footer';
import SiteHeader from '../../../../components/site-header';

export default async function OrderDetailRoute({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-brand-cream">
        <OrderDetailPage orderId={orderId} />
      </main>
      <SiteFooter />
    </>
  );
}
