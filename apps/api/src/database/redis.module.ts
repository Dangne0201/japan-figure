import { Global, Injectable, Logger, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfig } from '../config/env';

@Injectable()
class RedisConnection implements OnModuleDestroy {
  readonly client: Redis;
  private readonly logger = new Logger(RedisConnection.name);

  constructor(@Inject('APP_CONFIG') config: AppConfig) {
    this.client = new Redis(config.REDIS_URL, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => (attempt <= 3 ? attempt * 250 : null),
    });
    this.client.on('error', (error: Error) => this.logger.error(error.message));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}

@Global()
@Module({
  providers: [
    RedisConnection,
    {
      provide: 'REDIS_CLIENT',
      inject: [RedisConnection],
      useFactory: (connection: RedisConnection) => connection.client,
    },
  ],
  exports: ['REDIS_CLIENT'],
})
export class RedisModule {}
