import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('service worker does not cache Next.js chunks and replaces the previous cache', async () => {
  const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

  assert.match(serviceWorker, /const CACHE_NAME = 'japan-figure-static-v2'/u);
  assert.match(serviceWorker, /url\.pathname\.startsWith\('\/icons\/'\)/u);
  assert.doesNotMatch(serviceWorker, /\/_next\/static\//u);
  assert.match(serviceWorker, /key\.startsWith\('japan-figure-static-'\) && key !== CACHE_NAME/u);
});
