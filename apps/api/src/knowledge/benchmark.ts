import { execFileSync } from 'node:child_process';

interface ChatResult {
  message?: { content?: string };
  done?: boolean;
  eval_count?: number;
  eval_duration?: number;
  error?: string;
}

interface LoadedModel {
  name: string;
  size?: number;
  size_vram?: number;
}

const defaultBaseUrl =
  process.platform === 'win32' ? 'http://localhost:11434' : 'http://host.docker.internal:11434';
const baseUrl = process.env.OLLAMA_BASE_URL ?? defaultBaseUrl;
const models = [
  process.env.OLLAMA_CHAT_MODEL ?? 'qwen2.5:3b-instruct',
  process.env.OLLAMA_CHAT_FALLBACK_MODEL ?? 'qwen2.5:1.5b-instruct',
];
const benchmarkMessages = [
  {
    role: 'system',
    content:
      'Bạn là trợ lý tư vấn của cửa hàng Japan Figure. Chỉ trả lời dựa trên tài liệu sau. Nếu tài liệu không trả lời câu hỏi, hãy nói rằng bạn chưa có thông tin. Trả lời ngắn gọn bằng tiếng Việt.\n\nTài liệu: Đặt figure trên bề mặt phẳng, tránh ánh nắng trực tiếp, nguồn nhiệt và môi trường ẩm kéo dài. Lau bụi nhẹ bằng cọ mềm, sạch. Không dùng dung môi, chất tẩy rửa mạnh hoặc nước nóng khi chưa kiểm tra hướng dẫn chăm sóc cụ thể của sản phẩm.',
  },
  { role: 'user', content: 'Làm thế nào để bảo quản figure khỏi bụi?' },
];

async function main(): Promise<void> {
  for (const model of [...new Set(models)]) {
    let samplingError: Error | undefined;
    let baselineMemoryBytes: number | null = null;
    let peakMemoryBytes: number | null = null;
    let memorySampler: NodeJS.Timeout | undefined;
    try {
      await unloadModels(models);
      if (process.platform === 'win32') {
        baselineMemoryBytes = readWindowsOllamaMemory();
        peakMemoryBytes = baselineMemoryBytes;
        memorySampler = setInterval(() => {
          try {
            peakMemoryBytes = Math.max(peakMemoryBytes ?? 0, readWindowsOllamaMemory());
          } catch (error) {
            samplingError =
              error instanceof Error ? error : new Error('Could not sample Ollama memory.');
          }
        }, 1000);
      }

      const start = performance.now();
      const response = await fetch(new URL('/api/chat', baseUrl), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: benchmarkMessages,
          stream: true,
          keep_alive: process.platform === 'win32' ? 0 : '1m',
          options: { temperature: 0, num_predict: 128 },
        }),
        signal: AbortSignal.timeout(600_000),
      });
      if (!response.ok) {
        throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`);
      }
      if (!response.body) throw new Error('Ollama did not return a response body.');

      let generatedTokens = 0;
      let generationNanoseconds = 0;
      let answer = '';
      for await (const line of readLines(response.body)) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as ChatResult;
        if (event.error) throw new Error(event.error);
        answer += event.message?.content ?? '';
        if (event.done) {
          generatedTokens = event.eval_count ?? 0;
          generationNanoseconds = event.eval_duration ?? 0;
        }
      }
      if (!generatedTokens || !generationNanoseconds) {
        throw new Error('Ollama did not report eval_count and eval_duration.');
      }

      if (memorySampler) {
        clearInterval(memorySampler);
        memorySampler = undefined;
        peakMemoryBytes = Math.max(peakMemoryBytes ?? 0, readWindowsOllamaMemory());
        if (samplingError) throw samplingError;
        if (!peakMemoryBytes) {
          throw new Error('Could not find an Ollama process to measure on the Windows host.');
        }
      }

      const loadedModels = process.platform === 'win32' ? [] : await readLoadedModels();
      const loaded = loadedModels.find(
        ({ name }) => name === model || name.startsWith(`${model}:`),
      );
      const seconds = generationNanoseconds / 1_000_000_000;
      console.info(
        JSON.stringify({
          model,
          tokens_per_second: Number((generatedTokens / seconds).toFixed(2)),
          generated_tokens: generatedTokens,
          answer,
          memory_metric:
            process.platform === 'win32'
              ? 'peak_ollama_and_model_runner_working_set'
              : 'ollama_loaded_model_size',
          baseline_memory_bytes: baselineMemoryBytes,
          peak_memory_bytes: peakMemoryBytes ?? loaded?.size ?? null,
          peak_memory_delta_bytes:
            baselineMemoryBytes !== null && peakMemoryBytes !== null
              ? Math.max(0, peakMemoryBytes - baselineMemoryBytes)
              : null,
          model_load_bytes: loaded?.size ?? null,
          model_vram_bytes: loaded?.size_vram ?? null,
          elapsed_seconds: Number(((performance.now() - start) / 1000).toFixed(2)),
        }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          model,
          error: error instanceof Error ? error.message : 'Unknown benchmark error',
        }),
      );
      process.exitCode = 1;
    } finally {
      if (memorySampler) clearInterval(memorySampler);
    }
  }
}

function readWindowsOllamaMemory(): number {
  const command =
    "$processes = Get-Process -Name 'ollama*','llama-server*' -ErrorAction SilentlyContinue; " +
    '$bytes = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum; ' +
    'if ($null -eq $bytes) { $bytes = 0 }; Write-Output ([long]$bytes)';
  const output = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { encoding: 'utf8', timeout: 5000 },
  ).trim();
  const bytes = Number(output);
  if (!Number.isSafeInteger(bytes) || bytes < 0) {
    throw new Error('PowerShell returned an invalid Ollama process memory value.');
  }
  return bytes;
}

async function readLoadedModels(): Promise<LoadedModel[]> {
  const response = await fetch(new URL('/api/ps', baseUrl), {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Ollama /api/ps returned HTTP ${response.status}.`);
  const body = (await response.json()) as { models?: LoadedModel[] };
  return body.models ?? [];
}

async function unloadModels(modelsToUnload: string[]): Promise<void> {
  const loadedModels = await readLoadedModels();
  const models = new Set([...modelsToUnload, ...loadedModels.map(({ name }) => name)]);
  for (const model of models) {
    const response = await fetch(new URL('/api/generate', baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, keep_alive: 0, stream: false }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Could not unload Ollama model "${model}" (HTTP ${response.status}).`);
    }
    await response.json();
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (!(await readLoadedModels()).length) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Ollama still reports a loaded model after requesting unload.');
}

async function* readLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/u);
      buffer = lines.pop() ?? '';
      for (const line of lines) yield line;
      if (done) break;
    }
    if (buffer) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Unknown benchmark failure');
  process.exitCode = 1;
});
