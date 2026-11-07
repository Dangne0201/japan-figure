import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slugPattern.test(slug)) return new Response('Not found', { status: 404 });

  const localImage = await readFirstAvailable([
    path.join(process.cwd(), 'local-images', `${slug}.webp`),
    path.join(process.cwd(), '..', '..', 'local-images', `${slug}.webp`),
  ]);
  if (localImage) {
    return new Response(Uint8Array.from(localImage), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const placeholder = await readFirstAvailable([
    path.join(process.cwd(), 'public', 'products', `${slug}.svg`),
    path.join(process.cwd(), 'apps', 'web', 'public', 'products', `${slug}.svg`),
  ]);
  if (!placeholder) return new Response('Not found', { status: 404 });

  return new Response(Uint8Array.from(placeholder), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readFirstAvailable(paths: string[]): Promise<Buffer | null> {
  for (const filePath of paths) {
    try {
      return await readFile(filePath);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
  return null;
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
