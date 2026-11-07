import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadApiClient(fetchMock) {
  const source = await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  new Function('exports', 'fetch', output)(exports, fetchMock);
  return exports;
}

const response = (status) => ({ status, ok: status >= 200 && status < 300 });

test('authenticated requests refresh once after 401 and retry with credentials', async () => {
  const calls = [];
  const client = await loadApiClient(async (url, init) => {
    calls.push({ url, init });
    if (url === '/api/auth/refresh') return response(200);
    return response(calls.filter((call) => call.url === url).length === 1 ? 401 : 200);
  });

  const result = await client.authenticatedFetch('/api/addresses', {
    method: 'POST',
    body: '{"label":"Home"}',
  });

  assert.equal(result.status, 200);
  assert.deepEqual(
    calls.map(({ url }) => url),
    ['/api/addresses', '/api/auth/refresh', '/api/addresses'],
  );
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[2].init.body, '{"label":"Home"}');
});

test('concurrent 401 responses share one refresh request', async () => {
  let releaseRefresh;
  let refreshCount = 0;
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve;
  });
  const client = await loadApiClient(async (url) => {
    if (url === '/api/auth/refresh') {
      refreshCount += 1;
      return refreshGate;
    }
    return response(401);
  });

  const first = client.authenticatedFetch('/api/addresses');
  const second = client.authenticatedFetch('/api/cart');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(refreshCount, 1);
  releaseRefresh(response(200));

  const results = await Promise.all([first, second]);
  assert.deepEqual(
    results.map(({ status }) => status),
    [401, 401],
  );
});

test('returns the original 401 without retrying when refresh fails', async () => {
  const calls = [];
  const client = await loadApiClient(async (url) => {
    calls.push(url);
    return response(401);
  });

  const result = await client.authenticatedFetch('/api/addresses');

  assert.equal(result.status, 401);
  assert.deepEqual(calls, ['/api/addresses', '/api/auth/refresh']);
});
