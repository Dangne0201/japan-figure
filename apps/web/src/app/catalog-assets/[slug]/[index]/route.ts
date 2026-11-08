import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string; index: string }> },
) {
  const { slug, index } = await context.params;
  const imageIndex = Number(index);
  if (
    !slugPattern.test(slug) ||
    !Number.isInteger(imageIndex) ||
    imageIndex < 2 ||
    imageIndex > 5
  ) {
    return new Response('Not found', { status: 404 });
  }

  const fileName = `${slug}-${imageIndex}.webp`;
  const candidates = [
    path.join(process.cwd(), 'local-images', fileName),
    path.join(process.cwd(), '..', '..', 'local-images', fileName),
  ];
  for (const filePath of candidates) {
    try {
      const image = await readFile(/* turbopackIgnore: true */ filePath);
      return new Response(Uint8Array.from(image), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'private, max-age=60',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
  return new Response('Not found', { status: 404 });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
