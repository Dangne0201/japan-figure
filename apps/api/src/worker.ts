import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import Redis from 'ioredis';
import { loadConfig } from './config/env';
import { runOrderLifecycleSweep } from './commerce/order-worker';

const ORDER_QUEUE = 'order-lifecycle';
const SWEEP_INTERVAL_MS = 15_000;

async function startWorker(): Promise<void> {
  const config = loadConfig();
  const queueConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const workerConnection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  const queue = new Queue(ORDER_QUEUE, { connection: queueConnection });
  const prisma = new PrismaClient();
  const mailer = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: false,
  });

  queueConnection.on('error', (error) =>
    console.error('Order queue Redis connection error:', error.message),
  );
  workerConnection.on('error', (error) =>
    console.error('Order worker Redis connection error:', error.message),
  );

  const worker = new Worker(
    ORDER_QUEUE,
    async (job) => {
      if (job.name !== 'sweep') throw new Error(`Unknown order job: ${job.name}`);
      await runOrderLifecycleSweep(prisma, mailer, config);
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
    await queue.close();
    mailer.close();
    await Promise.all([queueConnection.quit(), workerConnection.quit(), prisma.$disconnect()]);
    throw error;
  }
  console.info(
    JSON.stringify({ event: 'order-lifecycle.worker.started', intervalMs: SWEEP_INTERVAL_MS }),
  );

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await worker.close();
    await queue.close();
    mailer.close();
    await Promise.all([queueConnection.quit(), workerConnection.quit(), prisma.$disconnect()]);
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

void startWorker().catch((error: unknown) => {
  console.error('Order lifecycle worker startup failed:', error);
  process.exitCode = 1;
});
