import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AccessTokenGuard, OptionalAccessTokenGuard } from './access-token.guard';
import { AuthMailerService } from './auth-mailer.service';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { CartCoreModule } from '../cart/cart-core.module';
import type { AppConfig } from '../config/env';

@Module({
  imports: [
    CartCoreModule,
    JwtModule.registerAsync({
      inject: ['APP_CONFIG'],
      useFactory: (config: AppConfig) => ({
        secret: config.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: config.AUTH_ACCESS_TOKEN_TTL_SECONDS },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthMailerService,
    AccessTokenGuard,
    OptionalAccessTokenGuard,
    RolesGuard,
  ],
  exports: [JwtModule, AuthService, AccessTokenGuard, OptionalAccessTokenGuard, RolesGuard],
})
export class AuthModule {}
