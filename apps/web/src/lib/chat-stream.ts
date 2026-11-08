export interface ServerSentEvent {
  event: string;
  data: unknown;
}

export async function* readServerSentEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ServerSentEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/gu, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseEvent(block);
        if (event) yield event;
        boundary = buffer.indexOf('\n\n');
      }
      if (done) break;
    }

    const finalEvent = parseEvent(buffer);
    if (finalEvent) yield finalEvent;
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(block: string): ServerSentEvent | null {
  let event = 'message';
  const data: string[] = [];

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }

  if (data.length === 0) return null;
  const text = data.join('\n');
  try {
    return { event, data: JSON.parse(text) as unknown };
  } catch (error) {
    throw new Error('Dữ liệu streaming từ máy chủ không hợp lệ.', { cause: error });
  }
}
