import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, KnowledgeModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
