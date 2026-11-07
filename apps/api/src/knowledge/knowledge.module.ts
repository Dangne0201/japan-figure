import { Module } from '@nestjs/common';
import { EmbeddingClient } from './embedding-client';
import { KnowledgeIndexer } from './knowledge-indexer.service';
import { KnowledgeQueue } from './knowledge-queue.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';
import { LlmProvider } from './llm-provider';

@Module({
  providers: [
    EmbeddingClient,
    KnowledgeIndexer,
    KnowledgeQueue,
    KnowledgeRetrievalService,
    LlmProvider,
  ],
  exports: [
    EmbeddingClient,
    KnowledgeIndexer,
    KnowledgeQueue,
    KnowledgeRetrievalService,
    LlmProvider,
  ],
})
export class KnowledgeModule {}
