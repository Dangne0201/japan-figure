import 'reflect-metadata';
import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import { loadConfig } from './config/env';
import { PrismaService } from './database/prisma.service';
import { runOrderLifecycleSweep } from './commerce/order-worker';
import { EmbeddingClient } from './knowledge/embedding-client';
import { KnowledgeIndexer } from './knowledge/knowledge-indexer.service';
import { KNOWLEDGE_QUEUE } from './knowledge/knowledge-queue.service';

const ORDER_QUEUE = 'order-lifecycle';
const SWEEP_INTERVAL_MS = 15_000;

async function startWorker(): Promise<void> {
  const config = loadConfig();
  const queueConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const knowledgeQueueConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const workerConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const knowledgeWorkerConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const queue = new Queue(ORDER_QUEUE, { connection: queueConnection });
  const knowledgeQueue = new Queue<{ productId: string }>(KNOWLEDGE_QUEUE, {
    connection: knowledgeQueueConnection,
  });
  const prisma = new PrismaService();
  const knowledgeIndexer = new KnowledgeIndexer(prisma, new EmbeddingClient(config));
  const mailer = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
  });

  queueConnection.on('error', (error) =>
    console.error('Order queue Redis connection error:', error.message),
  );
  knowledgeQueueConnection.on('error', (error) =>
    console.error('Knowledge queue Redis connection error:', error.message),
  );
  workerConnection.on('error', (error) =>
    console.error('Order worker Redis connection error:', error.message),
  );
  knowledgeWorkerConnection.on('error', (error) =>
    console.error('Knowledge worker Redis connection error:', error.message),
  );

  const worker = new Worker(
    ORDER_QUEUE,
    async (job) => {
      if (job.name !== 'sweep') throw new Error(`Unknown order job: ${job.name}`);
      await runOrderLifecycleSweep(prisma, mailer, config, async (productId) =>
        enqueueProductKnowledge(knowledgeQueue, productId),
      );
      console.info(JSON.stringify({ event: 'order-lifecycle.sweep.completed', jobId: job.id }));
    },
    { connection: workerConnection, concurrency: 1 },
  );
  worker.on('failed', (job, error) => {
    console.error(
      JSON.stringify({
        event: 'order-lifecycle.sweep.failed',
        jobId: job?.id,
        error: error.message,
      }),
    );
  });
  worker.on('error', (error) => {
    console.error(JSON.stringify({ event: 'order-lifecycle.worker.error', error: error.message }));
  });

  const knowledgeWorker = new Worker<{ productId: string }>(
    KNOWLEDGE_QUEUE,
    async (job) => {
      if (job.name !== 'index-product') throw new Error(`Unknown knowledge job: ${job.name}`);
      await knowledgeIndexer.reindexProduct(job.data.productId);
      console.info(
        JSON.stringify({
          event: 'knowledge.product-index.completed',
          productId: job.data.productId,
          jobId: job.id,
        }),
      );
    },
    { connection: knowledgeWorkerConnection, concurrency: 1 },
  );
  knowledgeWorker.on('failed', (job, error) => {
    console.error(
      JSON.stringify({
        event: 'knowledge.product-index.failed',
        productId: job?.data.productId,
        jobId: job?.id,
        error: error.message,
      }),
    );
  });
  knowledgeWorker.on('error', (error) => {
    console.error(JSON.stringify({ event: 'knowledge.worker.error', error: error.message }));
  });

  try {
    await prisma.$connect();
    await queue.add(
      'sweep',
      {},
      {
        jobId: 'order-lifecycle-sweep',
        repeat: { every: SWEEP_INTERVAL_MS },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  } catch (error) {
    await worker.close();
    await knowledgeWorker.close();
    await queue.close();
    await knowledgeQueue.close();
    mailer.close();
    await Promise.all([
      queueConnection.quit(),
      knowledgeQueueConnection.quit(),
      workerConnection.quit(),
      knowledgeWorkerConnection.quit(),
      prisma.$disconnect(),
    ]);
    throw error;
  }
  console.info(
    JSON.stringify({ event: 'order-lifecycle.worker.started', intervalMs: SWEEP_INTERVAL_MS }),
  );
  console.info(JSON.stringify({ event: 'knowledge.worker.started', queue: KNOWLEDGE_QUEUE }));

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    await knowledgeWorker.close();
    await queue.close();
    await knowledgeQueue.close();
    mailer.close();
    await Promise.all([
      queueConnection.quit(),
      knowledgeQueueConnection.quit(),
      workerConnection.quit(),
      knowledgeWorkerConnection.quit(),
      prisma.$disconnect(),
    ]);
  };
  process.once('SIGINT', () => {
    void shutdown()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error('Order lifecycle worker shutdown failed:', error);
        process.exit(1);
      });
  });
  process.once('SIGTERM', () => {
    void shutdown()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error('Order lifecycle worker shutdown failed:', error);
        process.exit(1);
      });
  });
}

async function enqueueProductKnowledge(
  queue: Queue<{ productId: string }>,
  productId: string,
): Promise<void> {
  await queue.add(
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

void startWorker().catch((error: unknown) => {
  console.error('Order lifecycle worker startup failed:', error);
  process.exitCode = 1;
});
