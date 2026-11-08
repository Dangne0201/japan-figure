import { loadConfig } from '../src/config/env';
import { LlmProvider } from '../src/knowledge/llm-provider';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
  LLM_RETRY_COUNT: '1',
});

describe('LlmProvider streaming', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not retry or switch models after partial output has been emitted', async () => {
    const fetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          '{"message":{"content":"Một phần câu trả lời"}}\n{"error":"stream failed"}\n',
          { status: 200 },
        ),
      );
    const provider = new LlmProvider(config);
    const output: string[] = [];

    await expect(async () => {
      for await (const token of provider.stream([{ role: 'user', content: 'Câu hỏi' }])) {
        output.push(token);
      }
    }).rejects.toThrow('partial output');

    expect(output).toEqual(['Một phần câu trả lời']);
    expect(fetch).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetch.mock.calls[0]?.[1]?.body)) as {
      options?: { temperature?: number; num_predict?: number };
    };
    expect(requestBody.options).toEqual({ temperature: 0.2, num_predict: 256 });
  });

  it('keeps the configured request timeout when also cancelling on client disconnect', async () => {
    const abortController = new AbortController();
    let requestSignal: AbortSignal | undefined;
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      requestSignal = init?.signal ?? undefined;
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            requestSignal?.addEventListener(
              'abort',
              () => controller.error(requestSignal?.reason),
              { once: true },
            );
          },
        }),
        { status: 200 },
      );
    });
    const provider = new LlmProvider(config);
    const output: string[] = [];
    const consume = (async () => {
      for await (const token of provider.stream(
        [{ role: 'user', content: 'Câu hỏi' }],
        abortController.signal,
      )) {
        output.push(token);
      }
    })();

    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(requestSignal).toBeDefined();
    expect(requestSignal).not.toBe(abortController.signal);

    abortController.abort();

    await expect(consume).rejects.toThrow();
    expect(output).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('aborts a provider request at its configured timeout', async () => {
    const timeoutConfig = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/test',
      REDIS_URL: 'redis://localhost:6379',
      JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
      LLM_REQUEST_TIMEOUT_MS: '1000',
      LLM_RETRY_COUNT: '0',
      OLLAMA_CHAT_MODEL: 'qwen2.5:3b-instruct',
      OLLAMA_CHAT_FALLBACK_MODEL: 'qwen2.5:3b-instruct',
    });
    const fetch = jest.spyOn(global, 'fetch').mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), {
            once: true,
          });
        }),
    );
    const provider = new LlmProvider(timeoutConfig);
    const output: string[] = [];
    const consume = async () => {
      for await (const chunk of provider.stream([{ role: 'user', content: 'Câu hỏi' }])) {
        output.push(chunk);
      }
    };

    await expect(consume()).rejects.toThrow('Ollama streaming failed');
    expect(output).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
