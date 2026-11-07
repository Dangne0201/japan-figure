import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import catalog from '../apps/api/prisma/seed-data/catalog.json' with { type: 'json' };

const root = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(root, '..', 'apps', 'web', 'public', 'products');
const palette = [
  ['#f3d9df', '#795b83', '#fffaf6'],
  ['#d7e9e2', '#4c7776', '#fffaf6'],
  ['#f4e4c9', '#9c654f', '#fffaf6'],
  ['#dce2f3', '#5b668c', '#fffaf6'],
  ['#f0d8c8', '#915c68', '#fffaf6'],
  ['#e6dff0', '#715a8e', '#fffaf6'],
];

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

await mkdir(outputDirectory, { recursive: true });

for (const [index, product] of catalog.products.entries()) {
  const [background, accent, paper] = palette[index % palette.length];
  const category =
    catalog.categories.find((item) => item.slug === product.category)?.name ?? 'Figure';
  const title = escapeXml(product.character);
  const series = escapeXml(catalog.series.find((item) => item.slug === product.series)?.name ?? '');
  const scale = escapeXml(product.scale ?? category);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000" role="img" aria-labelledby="title description">
  <title id="title">${title} — ${series}</title>
  <desc id="description">Original decorative placeholder artwork for ${title}, ${scale}.</desc>
  <defs>
    <linearGradient id="wash" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${background}"/></linearGradient>
    <pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2" fill="${accent}" opacity=".12"/></pattern>
  </defs>
  <rect width="800" height="1000" rx="48" fill="url(#wash)"/>
  <rect width="800" height="1000" rx="48" fill="url(#dots)"/>
  <circle cx="400" cy="410" r="210" fill="${paper}" opacity=".72"/>
  <circle cx="400" cy="410" r="168" fill="none" stroke="${accent}" stroke-width="2" opacity=".22"/>
  <path d="M400 220 425 365 560 410 425 455 400 600 375 455 240 410 375 365Z" fill="${accent}" opacity=".12"/>
  <path d="M400 286c-55 0-98 43-98 98 0 39 22 70 54 86l-22 150h132l-22-150c32-16 54-47 54-86 0-55-43-98-98-98Z" fill="${accent}" opacity=".2"/>
  <circle cx="400" cy="386" r="54" fill="${paper}" stroke="${accent}" stroke-width="5" opacity=".9"/>
  <path d="M300 570h200l42 104H258Z" fill="${accent}" opacity=".16"/>
  <text x="400" y="760" text-anchor="middle" fill="${accent}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700">${title}</text>
  <text x="400" y="812" text-anchor="middle" fill="${accent}" opacity=".78" font-family="Arial, Helvetica, sans-serif" font-size="23">${series}</text>
  <text x="400" y="890" text-anchor="middle" fill="${accent}" opacity=".7" font-family="Arial, Helvetica, sans-serif" font-size="18" letter-spacing="3">JAPAN FIGURE · ${scale.toUpperCase()}</text>
</svg>
`;
  await writeFile(path.join(outputDirectory, `${product.slug}.svg`), svg, 'utf8');
}

console.log(
  `Generated ${catalog.products.length} original product placeholder SVGs in ${outputDirectory}`,
);
