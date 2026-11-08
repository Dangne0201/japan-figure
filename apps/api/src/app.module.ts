import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { CatalogModule } from './catalog/catalog.module';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AddressesModule } from './addresses/addresses.module';
import { CartModule } from './cart/cart.module';
import { CommerceModule } from './commerce/commerce.module';
import { AdminModule } from './admin/admin.module';
import { ChatModule } from './chat/chat.module';
import { SameOriginGuard } from './auth/same-origin.guard';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    CatalogModule,
    AddressesModule,
    AuthModule,
    CartModule,
    CommerceModule,
    AdminModule,
    ChatModule,
    MetricsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, SameOriginGuard],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
