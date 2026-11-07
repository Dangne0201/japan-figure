import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type { AppConfig } from '../config/env';

export const KNOWLEDGE_QUEUE = 'knowledge-indexing';

export interface ProductKnowledgeQueue {
  enqueueProduct(productId: string): Promise<void>;
}

@Injectable()
export class KnowledgeQueue implements OnModuleDestroy, ProductKnowledgeQueue {
  private readonly logger = new Logger(KnowledgeQueue.name);
  private readonly connection: Redis;
  private readonly queue: Queue<{ productId: string }>;

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    this.connection = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
    });
    this.queue = new Queue(KNOWLEDGE_QUEUE, { connection: this.connection });
    this.queue.on('error', (error) =>
      this.logger.error(`Knowledge queue connection error: ${error.message}`),
    );
  }

  async enqueueProduct(productId: string): Promise<void> {
    await this.queue.add(
      'index-product',
      { productId },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.queue.close();
    } finally {
      await this.connection.quit();
    }
  }
}
