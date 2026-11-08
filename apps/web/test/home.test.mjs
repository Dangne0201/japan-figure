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

  assert.match(header, /href="\/account">\s*Tài khoản/u);
  assert.doesNotMatch(header, /href="\/login">\s*Tài khoản/u);
  assert.match(account, /Bạn chưa đăng nhập/u);
  assert.match(account, /href="\/login"/u);
});
