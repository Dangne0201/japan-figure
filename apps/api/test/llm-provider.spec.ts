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
  });
});
