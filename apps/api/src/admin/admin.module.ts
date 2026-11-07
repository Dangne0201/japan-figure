import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminOperationsService } from './admin-operations.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [AuthModule, KnowledgeModule],
  controllers: [AdminController],
  providers: [AdminService, AdminOperationsService],
})
export class AdminModule {}
