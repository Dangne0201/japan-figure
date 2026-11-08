import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { RedisModule } from '../database/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
