import { loadConfig } from '../src/config/env';

const requiredEnvironment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://japan_figure:localdevpassword@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadConfig', () => {
  it('rejects the example JWT secret even though it meets the minimum length', () => {
    expect(() =>
      loadConfig({
        ...requiredEnvironment,
        JWT_ACCESS_SECRET: 'change-me-to-a-long-random-secret',
      }),
    ).toThrow('Replace the example JWT secret with a random value.');
  });

  it('accepts a user-provided JWT secret of sufficient length', () => {
    expect(() =>
      loadConfig({
        ...requiredEnvironment,
        JWT_ACCESS_SECRET: 'a-user-generated-random-secret-of-at-least-32-characters',
      }),
    ).not.toThrow();
  });

  it('requires a Gemini API key only when Gemini is selected', () => {
    expect(() =>
      loadConfig({
        ...requiredEnvironment,
        JWT_ACCESS_SECRET: 'a-user-generated-random-secret-of-at-least-32-characters',
        LLM_PROVIDER: 'gemini',
      }),
    ).toThrow('GEMINI_API_KEY is required when LLM_PROVIDER=gemini.');

    expect(() =>
      loadConfig({
        ...requiredEnvironment,
        JWT_ACCESS_SECRET: 'a-user-generated-random-secret-of-at-least-32-characters',
        LLM_PROVIDER: 'gemini',
        GEMINI_API_KEY: 'test-key',
      }),
    ).not.toThrow();
  });

  it('requires secure cookies and an HTTPS browser origin in production', () => {
    const production = {
      ...requiredEnvironment,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a-user-generated-random-secret-of-at-least-32-characters',
      WEB_ORIGIN: 'https://shop.example',
    };

    expect(() => loadConfig(production)).toThrow('COOKIE_SECURE=true is required in production.');
    expect(() =>
      loadConfig({ ...production, COOKIE_SECURE: 'true', WEB_ORIGIN: 'http://shop.example' }),
    ).toThrow('WEB_ORIGIN must use HTTPS in production.');
    expect(() => loadConfig({ ...production, COOKIE_SECURE: 'true' })).not.toThrow();
  });
});
