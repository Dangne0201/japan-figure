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
    JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-jwt-signing',
    AUTH_ACCESS_TOKEN_TTL_SECONDS: 900,
    AUTH_REFRESH_TOKEN_TTL_DAYS: 30,
    AUTH_ACTION_TOKEN_TTL_HOURS: 24,
    COOKIE_SECURE: false,
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    MAIL_FROM: 'no-reply@japan-figure.local',
    OLLAMA_BASE_URL: 'http://127.0.0.1:11434',
    OLLAMA_CHAT_MODEL: 'test-chat',
    OLLAMA_CHAT_FALLBACK_MODEL: 'test-fallback',
    OLLAMA_EMBEDDING_MODEL: 'test-embedding',
    LLM_PROVIDER: 'ollama',
    LLM_REQUEST_TIMEOUT_MS: 30_000,
    LLM_RETRY_COUNT: 2,
    GEMINI_CHAT_MODEL: 'test-gemini',
    KNOWLEDGE_RELEVANCE_THRESHOLD: 0.42,
    KNOWLEDGE_TOP_K: 5,
    PRODUCT_UPLOAD_DIR: '/tmp/product-uploads',
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
