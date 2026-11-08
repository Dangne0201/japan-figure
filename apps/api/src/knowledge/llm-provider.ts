import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AppConfig } from '../config/env';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  message?: { content?: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

interface OllamaStreamPart {
  message?: { content?: string };
  error?: string;
  done?: boolean;
}

@Injectable()
export class LlmProvider {
  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {}

  async generate(messages: ChatMessage[]): Promise<string> {
    if (!messages.length) throw new RangeError('At least one chat message is required.');
    if (this.config.LLM_PROVIDER === 'gemini') {
      return this.withRetry(() => this.generateGemini(messages));
    }
    try {
      return await this.withRetry(() =>
        this.generateOllama(messages, this.config.OLLAMA_CHAT_MODEL),
      );
    } catch (primaryError) {
      if (this.config.OLLAMA_CHAT_FALLBACK_MODEL === this.config.OLLAMA_CHAT_MODEL) {
        throw primaryError;
      }
      try {
        return await this.withRetry(() =>
          this.generateOllama(messages, this.config.OLLAMA_CHAT_FALLBACK_MODEL),
        );
      } catch (fallbackError) {
        throw new ServiceUnavailableException(
          `Ollama chat failed for both configured models. Primary: ${errorMessage(primaryError)}. Fallback: ${errorMessage(fallbackError)}.`,
        );
      }
    }
  }

  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
    if (!messages.length) throw new RangeError('At least one chat message is required.');
    if (this.config.LLM_PROVIDER === 'gemini') {
      yield* this.streamGeminiWithRetry(messages, signal);
      return;
    }

    let primaryError: unknown;
    let primaryEmitted = false;
    for (let attempt = 0; attempt <= this.config.LLM_RETRY_COUNT; attempt += 1) {
      try {
        for await (const token of this.streamOllama(
          messages,
          this.config.OLLAMA_CHAT_MODEL,
          signal,
        )) {
          primaryEmitted = true;
          yield token;
        }
        return;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (primaryEmitted) {
          throw new ServiceUnavailableException(
            `Ollama stream failed after returning partial output: ${errorMessage(error)}`,
          );
        }
        primaryError = error;
        if (attempt < this.config.LLM_RETRY_COUNT) await delay(250 * 2 ** attempt);
      }
    }
    if (this.config.OLLAMA_CHAT_FALLBACK_MODEL === this.config.OLLAMA_CHAT_MODEL) {
      throw new ServiceUnavailableException(
        `Ollama streaming failed: ${errorMessage(primaryError)}`,
      );
    }
    try {
      yield* this.streamWithRetry(
        (signal) => this.streamOllama(messages, this.config.OLLAMA_CHAT_FALLBACK_MODEL, signal),
        signal,
      );
    } catch (fallbackError) {
      throw new ServiceUnavailableException(
        `Ollama streaming failed for both configured models. Primary: ${errorMessage(primaryError)}. Fallback: ${errorMessage(fallbackError)}.`,
      );
    }
  }

  private async generateOllama(messages: ChatMessage[], model: string): Promise<string> {
    const response = await this.request(new URL('/api/chat', this.config.OLLAMA_BASE_URL), {
      model,
      messages,
      stream: false,
      options: { temperature: 0.2, num_predict: 128 },
    });
    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as OllamaChatResponse;
    const answer = body.message?.content?.trim();
    if (!answer) throw new Error('Ollama returned an empty chat response.');
    return answer;
  }

  private async generateGemini(messages: ChatMessage[]): Promise<string> {
    const { systemInstruction, contents } = toGeminiMessages(messages);
    const response = await this.request(
      this.geminiUrl('generateContent'),
      {
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        contents,
        generationConfig: { temperature: 0.2 },
      },
      { 'x-goog-api-key': this.requireGeminiKey() },
    );
    const body = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(
        `Gemini returned HTTP ${response.status}: ${body.error?.message ?? 'unknown error'}`,
      );
    }
    const answer = body.candidates?.[0]?.content?.parts
      ?.map(({ text }) => text ?? '')
      .join('')
      .trim();
    if (!answer) throw new Error('Gemini returned an empty chat response.');
    return answer;
  }

  private async *streamOllama(
    messages: ChatMessage[],
    model: string,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const response = await this.request(
      new URL('/api/chat', this.config.OLLAMA_BASE_URL),
      {
        model,
        messages,
        stream: true,
        options: { temperature: 0.2, num_predict: 128 },
      },
      {},
      signal,
    );
    if (!response.ok) {
      throw new Error(`Ollama returned HTTP ${response.status}: ${await response.text()}`);
    }
    if (!response.body) throw new Error('Ollama did not return a streaming response body.');
    for await (const line of readLines(response.body)) {
      if (!line.trim()) continue;
      const part = JSON.parse(line) as OllamaStreamPart;
      if (part.error) throw new Error(`Ollama stream error: ${part.error}`);
      if (part.message?.content) yield part.message.content;
    }
  }

  private async *streamGeminiWithRetry(
    messages: ChatMessage[],
    externalSignal?: AbortSignal,
  ): AsyncGenerator<string> {
    try {
      yield* this.streamWithRetry((signal) => this.streamGemini(messages, signal), externalSignal);
    } catch (error) {
      throw new ServiceUnavailableException(`Gemini streaming failed: ${errorMessage(error)}`);
    }
  }

  private async *streamWithRetry(
    factory: (signal?: AbortSignal) => AsyncGenerator<string>,
    externalSignal?: AbortSignal,
  ): AsyncGenerator<string> {
    let failure: unknown;
    for (let attempt = 0; attempt <= this.config.LLM_RETRY_COUNT; attempt += 1) {
      let emitted = false;
      try {
        const timeoutSignal = AbortSignal.timeout(this.config.LLM_REQUEST_TIMEOUT_MS);
        const signal = externalSignal
          ? AbortSignal.any([timeoutSignal, externalSignal])
          : timeoutSignal;
        for await (const token of factory(signal)) {
          emitted = true;
          yield token;
        }
        return;
      } catch (error) {
        if (externalSignal?.aborted) throw error;
        if (emitted) throw error;
        failure = error;
        if (attempt < this.config.LLM_RETRY_COUNT) await delay(250 * 2 ** attempt);
      }
    }
    throw failure;
  }

  private async *streamGemini(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const { systemInstruction, contents } = toGeminiMessages(messages);
    const response = await this.request(
      this.geminiUrl('streamGenerateContent?alt=sse'),
      {
        ...(systemInstruction
          ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
          : {}),
        contents,
        generationConfig: { temperature: 0.2 },
      },
      { 'x-goog-api-key': this.requireGeminiKey() },
      signal,
    );
    if (!response.ok) {
      throw new Error(`Gemini returned HTTP ${response.status}: ${await response.text()}`);
    }
    if (!response.body) throw new Error('Gemini did not return a streaming response body.');
    for await (const line of readLines(response.body)) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === '[DONE]') continue;
      const event = JSON.parse(raw) as GeminiResponse;
      const text = event.candidates?.[0]?.content?.parts
        ?.map(({ text: partText }) => partText ?? '')
        .join('');
      if (text) yield text;
      if (event.error?.message) throw new Error(`Gemini stream error: ${event.error.message}`);
    }
  }

  private request(
    url: URL,
    body: unknown,
    headers: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<Response> {
    const timeoutSignal = AbortSignal.timeout(this.config.LLM_REQUEST_TIMEOUT_MS);
    const requestSignal = signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal;
    return fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: requestSignal,
    });
  }

  private geminiUrl(method: string): URL {
    return new URL(
      `/v1beta/models/${encodeURIComponent(this.config.GEMINI_CHAT_MODEL)}:${method}`,
      'https://generativelanguage.googleapis.com',
    );
  }

  private requireGeminiKey(): string {
    if (!this.config.GEMINI_API_KEY) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is required for the Gemini provider.');
    }
    return this.config.GEMINI_API_KEY;
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let failure: unknown;
    for (let attempt = 0; attempt <= this.config.LLM_RETRY_COUNT; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        failure = error;
        if (attempt < this.config.LLM_RETRY_COUNT) await delay(250 * 2 ** attempt);
      }
    }
    throw new ServiceUnavailableException(`LLM request failed: ${errorMessage(failure)}`);
  }
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

function toGeminiMessages(messages: ChatMessage[]): {
  systemInstruction?: string;
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemMessages = messages
    .filter(({ role }) => role === 'system')
    .map(({ content }) => content)
    .join('\n\n');
  const contents = messages
    .filter(({ role }) => role !== 'system')
    .map(({ role, content }) => ({
      role: role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: content }],
    }));
  if (!contents.length)
    throw new RangeError('Gemini requires at least one user or assistant message.');
  return { ...(systemMessages ? { systemInstruction: systemMessages } : {}), contents };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown provider error';
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
