import { Global, Module } from '@nestjs/common';
import { loadConfig } from './env';

@Global()
@Module({
  providers: [
    {
      provide: 'APP_CONFIG',
      useFactory: () => loadConfig(),
    },
  ],
  exports: ['APP_CONFIG'],
})
export class ConfigModule {}
