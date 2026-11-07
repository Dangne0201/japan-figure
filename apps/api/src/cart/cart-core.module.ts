import { Module } from '@nestjs/common';
import { RedisModule } from '../database/redis.module';
import { CartService } from './cart.service';

@Module({
  imports: [RedisModule],
  providers: [CartService],
  exports: [CartService],
})
export class CartCoreModule {}
