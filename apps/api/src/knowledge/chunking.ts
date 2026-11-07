export interface TextChunk {
  index: number;
  content: string;
}

const defaultMaxChars = 1200;
const defaultOverlapChars = 180;

export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[đĐ]/gu, (character) => (character === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function chunkMarkdown(
  markdown: string,
  maxChars = defaultMaxChars,
  overlapChars = defaultOverlapChars,
): TextChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 100) {
    throw new RangeError('maxChars must be an integer of at least 100.');
  }
  if (!Number.isInteger(overlapChars) || overlapChars < 0 || overlapChars >= maxChars) {
    throw new RangeError('overlapChars must be a non-negative integer smaller than maxChars.');
  }

  const paragraphs = markdown
    .replace(/\r\n?/gu, '\n')
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const pieces = paragraphs.flatMap((paragraph) =>
    paragraph.length > maxChars
      ? splitLongParagraph(paragraph, maxChars, overlapChars)
      : [paragraph],
  );
  const chunks: TextChunk[] = [];
  let current = '';

  for (const piece of pieces) {
    const candidate = current ? `${current}\n\n${piece}` : piece;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push({ index: chunks.length, content: current });
    const overlap = getOverlap(
      current,
      Math.max(0, Math.min(overlapChars, maxChars - piece.length - 2)),
    );
    current = overlap ? `${overlap}\n\n${piece}` : piece;
    if (current.length > maxChars) {
      throw new RangeError('A chunk could not be bounded to maxChars.');
    }
  }

  if (current) chunks.push({ index: chunks.length, content: current });
  return chunks;
}

function splitLongParagraph(paragraph: string, maxChars: number, overlapChars: number): string[] {
  const sentences = paragraph.split(/(?<=[.!?。！？])\s+/u).filter(Boolean);
  const output: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) output.push(current);
      current = '';
      const segmentLength = Math.max(1, maxChars - overlapChars - 2);
      for (let offset = 0; offset < sentence.length; offset += segmentLength) {
        output.push(sentence.slice(offset, offset + segmentLength));
      }
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars) {
      output.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) output.push(current);
  return output;
}

function getOverlap(value: string, maxChars: number): string {
  if (!value || maxChars === 0) return '';
  const tail = value.slice(-maxChars);
  const boundary = tail.indexOf(' ');
  return boundary >= 0 ? tail.slice(boundary + 1).trim() : tail;
}
