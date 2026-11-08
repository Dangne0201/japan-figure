import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function loadReader() {
  const source = await readFile(new URL('../src/lib/chat-stream.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  new Function('exports', output)(exports);
  return exports.readServerSentEvents;
}

test('parses SSE events across chunk boundaries and flushes the last event', async () => {
  const readServerSentEvents = await loadReader();
  const chunks = [
    new TextEncoder().encode('event: sources\ndata: [{"title":"Tài'),
    new TextEncoder().encode(' liệu"}]\n\nevent: token\ndata: {"text":"Xin ch'),
    new TextEncoder().encode('ào"}\n\n'),
    new TextEncoder().encode('event: done\ndata: {"messageId":"m1"}'),
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });

  const events = [];
  for await (const event of readServerSentEvents(stream)) events.push(event);

  assert.deepEqual(events, [
    { event: 'sources', data: [{ title: 'Tài liệu' }] },
    { event: 'token', data: { text: 'Xin chào' } },
    { event: 'done', data: { messageId: 'm1' } },
  ]);
});

test('reports invalid SSE JSON instead of silently ignoring it', async () => {
  const readServerSentEvents = await loadReader();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('event: token\ndata: {invalid}\n\n'));
      controller.close();
    },
  });

  await assert.rejects(async () => {
    for await (const event of readServerSentEvents(stream)) {
      throw new Error(`Unexpected valid event: ${event.event}`);
    }
  }, /Dữ liệu streaming từ máy chủ không hợp lệ/u);
});
