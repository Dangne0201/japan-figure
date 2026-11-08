import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AccessTokenGuard } from '../auth/access-token.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ChatConversationListDto, ChatFeedbackDto, SendChatMessageDto } from './chat.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
@UseGuards(AccessTokenGuard)
@ApiCookieAuth('jf_access')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a private conversation for the authenticated customer' })
  createConversation(@Req() request: Request & { user: AuthenticatedUser }) {
    return this.chat.createConversation(request.user.id);
  }

  @Get('conversations')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'List the authenticated customer’s conversations' })
  listConversations(
    @Req() request: Request & { user: AuthenticatedUser },
    @Query() query: ChatConversationListDto,
  ) {
    return this.chat.listConversations(request.user.id, query.page, query.limit);
  }

  @Get('conversations/:conversationId')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Read an owned conversation and its recent messages' })
  getConversation(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('conversationId') conversationId: string,
  ) {
    return this.chat.getConversation(request.user.id, conversationId);
  }

  @Delete('conversations/:conversationId')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete an owned conversation and its messages' })
  deleteConversation(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('conversationId') conversationId: string,
  ) {
    return this.chat.deleteConversation(request.user.id, conversationId);
  }

  @Patch('messages/:messageId/feedback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Save feedback on an owned assistant response' })
  setFeedback(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('messageId') messageId: string,
    @Body() body: ChatFeedbackDto,
  ) {
    return this.chat.setFeedback(request.user.id, messageId, body.rating);
  }

  @Post('conversations/:conversationId/messages')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message and stream its grounded answer as server-sent events' })
  async sendMessage(
    @Req() request: Request & { user: AuthenticatedUser },
    @Param('conversationId') conversationId: string,
    @Body() body: SendChatMessageDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.chat.assertConversationOwner(request.user.id, conversationId);

    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders();
    writeEvent(response, 'start', { conversationId });

    const abortController = new AbortController();
    const abort = () => abortController.abort();
    request.once('aborted', abort);
    response.once('close', () => {
      if (!response.writableEnded) abort();
    });

    try {
      const result = await this.chat.streamMessage(
        request.user.id,
        conversationId,
        body.content,
        (sources) => writeEvent(response, 'sources', sources),
        (text) => writeEvent(response, 'token', { text }),
        abortController.signal,
      );
      writeEvent(response, 'done', result);
    } catch (error) {
      if (!abortController.signal.aborted) {
        this.logger.error(
          `Chat stream failed for conversation ${conversationId}.`,
          error instanceof Error ? error.stack : String(error),
        );
        writeEvent(response, 'error', {
          message: 'Xin lỗi, trợ lý chưa thể trả lời lúc này. Bạn vui lòng thử lại sau.',
        });
      }
    } finally {
      request.off('aborted', abort);
      if (!response.destroyed) response.end();
    }
  }
}

function writeEvent(response: Response, event: string, data: unknown): void {
  if (response.destroyed) return;
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
