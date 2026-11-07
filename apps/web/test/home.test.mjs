import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('storefront landing page includes Vietnamese copy and system connectivity checks', async () => {
  const page = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /Mô hình|figure|bộ sưu tập/u);
  assert.match(page, /api\/health/u);
  assert.match(page, /PostgreSQL/u);
  assert.match(page, /Redis/u);
  assert.match(page, /Đang gặp sự cố/u);
  assert.match(page, /statusLabel\(checks\.ollama\.status, true\)/u);
  assert.match(page, /role="status"/u);
});
