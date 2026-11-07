import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AppConfig } from '../config/env';

interface OllamaEmbeddingResponse {
  embeddings?: number[][];
  embedding?: number[];
  error?: string;
}

export const EMBEDDING_DIMENSIONS = 1024;

@Injectable()
export class EmbeddingClient {
  constructor(@Inject('APP_CONFIG') private readonly config: AppConfig) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];
    let failure: unknown;
    for (let attempt = 0; attempt <= this.config.LLM_RETRY_COUNT; attempt += 1) {
      try {
        const response = await fetch(new URL('/api/embed', this.config.OLLAMA_BASE_URL), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ model: this.config.OLLAMA_EMBEDDING_MODEL, input: texts }),
          signal: AbortSignal.timeout(this.config.LLM_REQUEST_TIMEOUT_MS),
        });
        const body = (await response.json()) as OllamaEmbeddingResponse;
        if (!response.ok) {
          throw new Error(
            `Ollama embedding returned HTTP ${response.status}: ${body.error ?? 'unknown error'}`,
          );
        }
        const vectors = body.embeddings ?? (body.embedding ? [body.embedding] : []);
        if (vectors.length !== texts.length) {
          throw new Error(
            `Ollama returned ${vectors.length} embeddings for ${texts.length} input texts.`,
          );
        }
        for (const [index, vector] of vectors.entries()) {
          if (
            vector.length !== EMBEDDING_DIMENSIONS ||
            vector.some((value) => !Number.isFinite(value))
          ) {
            throw new Error(
              `Embedding ${index} must contain exactly ${EMBEDDING_DIMENSIONS} finite values.`,
            );
          }
        }
        return vectors;
      } catch (error) {
        failure = error;
        if (attempt < this.config.LLM_RETRY_COUNT) {
          await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
        }
      }
    }
    const detail = failure instanceof Error ? failure.message : 'Unknown embedding provider error';
    throw new ServiceUnavailableException(
      `Could not create embeddings with Ollama model "${this.config.OLLAMA_EMBEDDING_MODEL}": ${detail}. Verify Ollama is running on the Windows host, the model is available, and host.docker.internal:11434 is reachable. If needed, set OLLAMA_HOST=0.0.0.0 and allow port 11434 through Windows Firewall on the Private network.`,
    );
  }
}
