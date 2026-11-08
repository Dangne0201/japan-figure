import { access } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!slugPattern.test(slug)) return Response.json({ message: 'Not found' }, { status: 404 });

  const images = [`/catalog-assets/${encodeURIComponent(slug)}`];
  for (let index = 2; index <= 5; index += 1) {
    const fileName = `${slug}-${index}.webp`;
    const candidates = [
      path.join(process.cwd(), 'local-images', fileName),
      path.join(process.cwd(), '..', '..', 'local-images', fileName),
    ];
    for (const candidate of candidates) {
      try {
        await access(candidate);
        images.push(`/catalog-assets/${encodeURIComponent(slug)}/${index}`);
        break;
      } catch (error) {
        if (!isMissingFile(error)) throw error;
      }
    }
  }

  return Response.json(images, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
