import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [AuthModule, KnowledgeModule],
  controllers: [CheckoutController, OrdersController],
  providers: [CheckoutService, OrdersService],
})
export class CommerceModule {}
