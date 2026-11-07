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
});
