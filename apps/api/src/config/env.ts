import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32)
      .refine((value) => value !== 'change-me-to-a-long-random-secret', {
        message: 'Replace the example JWT secret with a random value.',
      }),
    AUTH_ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    AUTH_ACTION_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(48).default(24),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_HOST: z.string().default('mailpit'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    MAIL_FROM: z.string().email().default('no-reply@japan-figure.local'),
    OLLAMA_BASE_URL: z.string().url().default('http://host.docker.internal:11434'),
    OLLAMA_CHAT_MODEL: z.string().default('qwen2.5:3b-instruct'),
    OLLAMA_CHAT_FALLBACK_MODEL: z.string().default('qwen2.5:1.5b-instruct'),
    OLLAMA_EMBEDDING_MODEL: z.string().default('bge-m3'),
    LLM_PROVIDER: z.enum(['ollama', 'gemini']).default('ollama'),
    LLM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
    LLM_RETRY_COUNT: z.coerce.number().int().min(0).max(5).default(2),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_CHAT_MODEL: z.string().default('gemini-2.5-flash'),
    KNOWLEDGE_RELEVANCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.42),
    KNOWLEDGE_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
    PRODUCT_UPLOAD_DIR: z.string().min(1).default('/app/product-uploads'),
  })
  .superRefine((config, context) => {
    if (config.LLM_PROVIDER === 'gemini' && !config.GEMINI_API_KEY?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['GEMINI_API_KEY'],
        message: 'GEMINI_API_KEY is required when LLM_PROVIDER=gemini.',
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(source);
}
