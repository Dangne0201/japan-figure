import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartCoreModule } from './cart-core.module';
import { CartController } from './cart.controller';

@Module({
  imports: [AuthModule, CartCoreModule],
  controllers: [CartController],
})
export class CartModule {}
