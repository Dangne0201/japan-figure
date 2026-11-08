import { ChatFeedbackRating } from '../generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ChatConversationListDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class SendChatMessageDto {
  @ApiProperty({ example: 'Figure này còn hàng không?', minLength: 1, maxLength: 500 })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @MinLength(1)
  @MaxLength(500)
  content!: string;
}

export class ChatFeedbackDto {
  @ApiProperty({ enum: ChatFeedbackRating })
  @IsEnum(ChatFeedbackRating)
  rating!: ChatFeedbackRating;
}
