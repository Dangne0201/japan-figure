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
