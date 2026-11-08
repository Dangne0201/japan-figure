import SiteFooter from '../../../components/site-footer';
import SiteHeader from '../../../components/site-header';
import WishlistPage from '../../../components/wishlist-page';

export default function AccountWishlistPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-brand-cream">
        <WishlistPage />
      </main>
      <SiteFooter />
    </>
  );
}
