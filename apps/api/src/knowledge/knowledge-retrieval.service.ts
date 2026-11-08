import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { KnowledgeSourceType } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { normalizeForSearch } from './chunking';
import type { AppConfig } from '../config/env';
import { EmbeddingClient } from './embedding-client';

export interface RawKnowledgeCandidate {
  id: string;
  source_type: KnowledgeSourceType;
  source_id: string;
  source_title: string;
  source_path: string | null;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  vector_score: number;
  keyword_score: number;
}

export interface KnowledgeResult {
  content: string;
  score: number;
  source: {
    type: 'document' | 'product';
    id: string;
    title: string;
    path: string | null;
    chunkIndex: number;
  };
  metadata: Record<string, unknown>;
}

export function scoreHybridCandidate(vectorScore: number, keywordScore: number): number {
  const safeVectorScore = Number.isFinite(vectorScore) ? Math.max(0, Math.min(1, vectorScore)) : 0;
  const safeKeywordScore = Number.isFinite(keywordScore)
    ? Math.max(0, Math.min(1, keywordScore))
    : 0;
  return 0.72 * safeVectorScore + 0.28 * safeKeywordScore;
}

export function rankKnowledgeCandidates(
  candidates: RawKnowledgeCandidate[],
  threshold: number,
  topK: number,
): KnowledgeResult[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: scoreHybridCandidate(candidate.vector_score, candidate.keyword_score),
    }))
    .filter(({ score }) => score >= threshold)
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map(({ candidate, score }) => ({
      content: candidate.content,
      score,
      source: {
        type: candidate.source_type === KnowledgeSourceType.PRODUCT ? 'product' : 'document',
        id: candidate.source_id,
        title: candidate.source_title,
        path: candidate.source_path,
        chunkIndex: candidate.chunk_index,
      },
      metadata: candidate.metadata,
    }));
}

@Injectable()
export class KnowledgeRetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingClient,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  async search(question: string): Promise<KnowledgeResult[]> {
    const query = question.trim();
    if (!query || query.length > 500) {
      throw new BadRequestException('Search text must contain 1 to 500 characters.');
    }

    const normalizedQuery = normalizeForSearch(query);
    if (!normalizedQuery) {
      throw new BadRequestException('Search text must contain searchable characters.');
    }
    const [vector] = await this.embeddings.embed([query]);
    if (!vector) throw new Error('Embedding provider returned no vector for the search query.');
    const vectorLiteral = `[${vector.join(',')}]`;
    const likeQuery = normalizedQuery.replace(/[\\%_]/gu, '\\$&');
    const candidates = await this.prisma.$queryRaw<RawKnowledgeCandidate[]>`
      WITH candidates AS (
        (
          SELECT
            id, source_type, source_id, source_title, source_path, chunk_index,
            content, metadata,
            GREATEST(0, 1 - (embedding <=> ${vectorLiteral}::vector))::float8 AS vector_score,
            0::float8 AS keyword_score
          FROM knowledge_chunks
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${vectorLiteral}::vector
          LIMIT 100
        )
        UNION ALL
        (
          SELECT
            id, source_type, source_id, source_title, source_path, chunk_index,
            content, metadata, 0::float8 AS vector_score,
            GREATEST(
              similarity(normalized_content, ${normalizedQuery}),
              word_similarity(${normalizedQuery}, normalized_content),
              CASE WHEN normalized_content ILIKE ${`%${likeQuery}%`} ESCAPE '\\' THEN 1 ELSE 0 END
            )::float8 AS keyword_score
          FROM knowledge_chunks
          WHERE normalized_content % ${normalizedQuery}
             OR word_similarity(${normalizedQuery}, normalized_content) >= 0.3
             OR normalized_content ILIKE ${`%${likeQuery}%`} ESCAPE '\\'
          ORDER BY GREATEST(
            similarity(normalized_content, ${normalizedQuery}),
            word_similarity(${normalizedQuery}, normalized_content),
            CASE WHEN normalized_content ILIKE ${`%${likeQuery}%`} ESCAPE '\\' THEN 1 ELSE 0 END
          ) DESC
          LIMIT 100
        )
      )
      SELECT
        id, source_type, source_id, source_title, source_path, chunk_index,
        content, metadata, MAX(vector_score) AS vector_score,
        MAX(keyword_score) AS keyword_score
      FROM candidates
      GROUP BY id, source_type, source_id, source_title, source_path, chunk_index, content, metadata
    `;

    return rankKnowledgeCandidates(
      candidates,
      this.config.KNOWLEDGE_RELEVANCE_THRESHOLD,
      this.config.KNOWLEDGE_TOP_K,
    );
  }
}
