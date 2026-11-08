import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('storefront home page includes catalog sections and educational demo disclosure', async () => {
  const page = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /figure|bộ sưu tập/u);
  assert.match(page, /getCatalogHome/u);
  assert.match(page, /Được yêu thích/u);
  assert.match(page, /Đặt trước/u);
  assert.match(page, /dữ liệu mô phỏng/u);
  assert.match(page, /role="status"/u);
});

test('account navigation opens the account page instead of always asking to log in', async () => {
  const header = await readFile(
    new URL('../src/components/site-header.tsx', import.meta.url),
    'utf8',
  );
  const account = await readFile(
    new URL('../src/components/account-profile.tsx', import.meta.url),
    'utf8',
  );

  assert.ok(header.includes('href="/account"'));
  assert.doesNotMatch(header, /href="\/login"[^>]*>\s*Tài khoản/u);
  assert.match(account, /Bạn chưa đăng nhập/u);
  assert.match(account, /href="\/login"/u);
});

test('storefront exposes mobile navigation, real catalog counts, and help content', async () => {
  const [layout, navigation, home, help] = await Promise.all([
    readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/mobile-bottom-nav.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/help/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(layout, /<MobileBottomNav \/>/u);
  assert.ok(navigation.includes("aria-current={active ? 'page' : undefined}"));
  assert.match(navigation, /href: '\/collections', label: 'Khám phá'/u);
  assert.match(home, /productCount/u);
  assert.match(help, /Không có kết nối ngân hàng/u);
  assert.match(help, /không xử lý hoàn tiền thật/u);
});

test('product images and quantity controls support local extra images only', async () => {
  const [galleryRoute, galleryUi, purchase, readme] = await Promise.all([
    readFile(new URL('../src/app/catalog-assets/[slug]/gallery/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/product-gallery.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/add-to-cart-button.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../README.md', import.meta.url), 'utf8'),
  ]);

  assert.match(galleryRoute, /local-images/u);
  assert.match(galleryRoute, /index <= 5/u);
  assert.match(galleryUi, /showModal/u);
  assert.match(purchase, /quantity/u);
  assert.match(purchase, /router\.push\('\/checkout'\)/u);
  assert.match(readme, /figure-2\.webp/u);
});

test('checkout login return path is restricted to internal paths', async () => {
  const [loginPage, checkout] = await Promise.all([
    readFile(new URL('../src/app/login/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/checkout-page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(loginPage, /startsWith\('\//u);
  assert.match(loginPage, /startsWith\('\/\/'\)/u);
  assert.match(loginPage, /includes\('\\\\'\)/u);
  assert.match(checkout, /login\?next=%2Fcheckout/u);
});

test('public banners are labeled by their schedule in the admin panel', async () => {
  const [admin, catalog] = await Promise.all([
    readFile(new URL('../src/components/admin-operations-panel.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../api/src/catalog/catalog.service.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(admin, /Sắp diễn ra/u);
  assert.match(admin, /Đã hết hạn/u);
  assert.match(admin, /Đang hiển thị/u);
  assert.match(catalog, /startsAt: \{ lte: now \}, endsAt: \{ gt: now \}/u);
});

test('catalog browsing includes release years, quick sorting, and removable filter chips', async () => {
  const [filters, listing, home] = await Promise.all([
    readFile(new URL('../src/components/catalog-filters.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/catalog-listing.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(filters, /name="releaseYear"/u);
  assert.match(filters, /productCount/u);
  assert.match(listing, /Sắp xếp sản phẩm/u);
  assert.match(listing, /Bỏ bộ lọc/u);
  assert.match(listing, /Xóa bộ lọc/u);
  assert.match(home, /Năm phát hành/u);
});

test('collection discovery links to live catalog facets and supported demo journeys', async () => {
  const [page, header, footer] = await Promise.all([
    readFile(new URL('../src/app/collections/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/site-header.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/components/site-footer.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /getCatalogFacets/u);
  assert.match(page, /title="Chọn theo dòng figure"/u);
  assert.match(page, /title="Gặp lại series bạn yêu"/u);
  assert.match(page, /title="Khám phá nhà sản xuất"/u);
  assert.match(page, /releaseYear=/u);
  assert.match(page, /không đại diện/u);
  assert.match(header, /href="\/collections"/u);
  assert.match(footer, /href="\/collections"/u);
});

test('product cards use approved review summaries and preorder detail explains simulated amounts', async () => {
  const [card, detail, api] = await Promise.all([
    readFile(new URL('../src/components/product-card.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/app/products/[slug]/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../api/src/catalog/catalog.service.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(card, /đánh giá đã duyệt/u);
  assert.match(detail, /Phần còn lại tham khảo/u);
  assert.match(detail, /không phải báo\s+giá hay yêu cầu thanh toán thật/u);
  assert.match(api, /status: 'APPROVED'/u);
  assert.match(api, /reviewCount: summary\._count\._all/u);
});

test('product taxonomy badges link to the matching catalog filters', async () => {
  const detail = await readFile(
    new URL('../src/app/products/[slug]/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(detail, /Duyệt sản phẩm liên quan/u);
  assert.match(detail, /product\.categories\[0\]\?\.slug/u);
  assert.match(detail, /product\.brand\.slug/u);
  assert.match(detail, /product\.series\.slug/u);
});
