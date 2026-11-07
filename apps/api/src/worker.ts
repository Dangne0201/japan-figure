import 'reflect-metadata';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { loadConfig } from './config/env';

async function startWorker(): Promise<void> {
  const config = loadConfig();
  const connection = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000),
  });
  connection.on('error', (error) => console.error('Worker Redis connection error:', error.message));

  const worker = new Worker(
    'foundation',
    async (job) => {
      console.info(JSON.stringify({ event: 'job.completed', jobId: job.id, name: job.name }));
      return { processed: true };
    },
    { connection },
  );
  worker.on('failed', (job, error) => {
    console.error(JSON.stringify({ event: 'job.failed', jobId: job?.id, error: error.message }));
  });

  const shutdown = async () => {
    await worker.close();
    await connection.quit();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
}

void startWorker().catch((error: unknown) => {
  console.error('Worker startup failed:', error);
  process.exitCode = 1;
});
