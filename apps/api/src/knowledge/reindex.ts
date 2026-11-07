import path from 'node:path';
import { loadConfig } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { EmbeddingClient } from './embedding-client';
import { KnowledgeIndexer } from './knowledge-indexer.service';

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const directory = path.resolve(__dirname, '../../../../knowledge');
    const result = await new KnowledgeIndexer(prisma, new EmbeddingClient(config)).reindexAll(
      directory,
    );
    console.info(JSON.stringify({ event: 'knowledge.reindex.completed', ...result }));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'knowledge.reindex.failed',
      error: error instanceof Error ? error.message : 'Unknown indexing error',
    }),
  );
  process.exitCode = 1;
});
