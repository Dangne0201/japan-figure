import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = new URL('../src/', import.meta.url);

async function findTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return findTypeScriptFiles(path);
      return entry.name.endsWith('.tsx') ? [path] : [];
    }),
  );
  return nested.flat();
}

test('all main landmarks are reachable from the global skip link', async () => {
  const layout = await readFile(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const files = await findTypeScriptFiles(fileURLToPath(sourceRoot));

  assert.match(layout, /href="#main-content"/u);
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const landmarks = source.match(/<main\b[^>]*>/gs) ?? [];
    for (const landmark of landmarks) {
      assert.match(
        landmark,
        /id="main-content"/u,
        `${file} has a main landmark without the skip target`,
      );
      assert.match(
        landmark,
        /tabIndex=\{-1\}/u,
        `${file} has a main landmark that cannot receive focus`,
      );
    }
  }
});

test('keyboard focus and skip navigation have visible styling', async () => {
  const styles = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');

  assert.match(styles, /:focus-visible\s*\{/u);
  assert.match(styles, /\.skip-link:focus\s*\{/u);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/u);
});

test('search suggestions support arrow navigation, selection, and Escape', async () => {
  const search = await readFile(
    new URL('../src/components/search-bar.tsx', import.meta.url),
    'utf8',
  );

  assert.match(search, /event\.key === 'ArrowDown'/u);
  assert.match(search, /event\.key === 'ArrowUp'/u);
  assert.match(search, /event\.key === 'Escape'/u);
  assert.match(search, /aria-activedescendant=/u);
  assert.match(search, /role="listbox"/u);
  assert.match(search, /role="option"/u);
});

test('mobile catalog filter dialog traps focus and restores it when closed', async () => {
  const filters = await readFile(
    new URL('../src/components/catalog-filters.tsx', import.meta.url),
    'utf8',
  );

  assert.match(filters, /role="dialog"/u);
  assert.match(filters, /aria-modal="true"/u);
  assert.match(filters, /event\.key === 'Escape'/u);
  assert.match(filters, /event\.key !== 'Tab'/u);
  assert.match(filters, /triggerRef\.current\?\.focus\(\)/u);
});
