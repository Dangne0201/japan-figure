import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/env';
import { PrismaService } from '../database/prisma.service';

export interface DependencyStatus {
  status: 'up' | 'down' | 'degraded';
  detail?: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
    ollama: DependencyStatus;
  };
}

@Injectable()
export class HealthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HealthService.name);
  private hasLoggedOllamaWarning = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.checkOllama();
  }

  async check(): Promise<HealthStatus> {
    const [database, redis, ollama] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkOllama(),
    ]);

    return {
      status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      checks: { database, redis, ollama },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', detail: this.errorMessage(error) };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    const redis = new Redis(this.config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy: () => null,
    });
    redis.on('error', () => undefined);
    try {
      await redis.connect();
      await redis.ping();
      return { status: 'up' };
    } catch (error) {
      return { status: 'down', detail: this.errorMessage(error) };
    } finally {
      redis.disconnect();
    }
  }

  private async checkOllama(): Promise<DependencyStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    try {
      const response = await fetch(new URL('/api/tags', this.config.OLLAMA_BASE_URL), {
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = `Ollama returned HTTP ${response.status}`;
        this.logOllamaWarning(detail);
        return { status: 'degraded', detail };
      }
      this.hasLoggedOllamaWarning = false;
      return { status: 'up' };
    } catch (error) {
      const detail = this.errorMessage(error);
      this.logOllamaWarning(detail);
      return { status: 'degraded', detail };
    } finally {
      clearTimeout(timeout);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private logOllamaWarning(detail: string): void {
    if (this.hasLoggedOllamaWarning) return;
    this.logger.warn(
      `Ollama is unavailable at ${this.config.OLLAMA_BASE_URL}. Start Ollama on Windows and, if containers cannot reach it, set OLLAMA_HOST=0.0.0.0 and allow port 11434 through Windows Firewall for the Private network. Details: ${detail}`,
    );
    this.hasLoggedOllamaWarning = true;
  }
}
