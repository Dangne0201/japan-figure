import { HealthService } from '../src/health/health.service';
import { PrismaService } from '../src/database/prisma.service';
import { AppConfig } from '../src/config/env';

describe('HealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const config: AppConfig = {
    NODE_ENV: 'test',
    API_PORT: 3001,
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    WEB_ORIGIN: 'http://localhost:3000',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
    OLLAMA_CHAT_MODEL: 'test-chat',
    OLLAMA_CHAT_FALLBACK_MODEL: 'test-fallback',
    OLLAMA_EMBEDDING_MODEL: 'test-embedding',
  };

  it('reports the required services as healthy and allows Ollama to be degraded', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Ollama is offline'));
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const service = new HealthService(prisma as unknown as PrismaService, config);
    const result = await service.check();

    expect(result.checks.database.status).toBe('up');
    expect(result.checks.redis.status).toBe('down');
    expect(result.checks.ollama.status).toBe('degraded');
    expect(result.status).toBe('degraded');
  });
});
