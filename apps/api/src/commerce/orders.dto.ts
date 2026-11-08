import { ApiProperty } from '@nestjs/swagger';
import { PaymentOutcome } from '../generated/prisma/client';
import { IsEnum, IsInt, IsString, Matches, Max, Min, MaxLength } from 'class-validator';

export class PaymentOutcomeDto {
  @ApiProperty({ example: 'local-event-01' })
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{1,100}$/)
  eventId!: string;

  @ApiProperty({ enum: PaymentOutcome })
  @IsEnum(PaymentOutcome)
  outcome!: PaymentOutcome;
}

export class CreateReviewDto {
  @ApiProperty({ example: 'cm123456789012345678901234' })
  @IsString()
  @Matches(/^c[a-z0-9]{20,30}$/)
  orderItemId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  body!: string;
}

export class AddWishlistItemDto {
  @ApiProperty({ example: 'nendoroid-character-name' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(180)
  productSlug!: string;
}

export class CreateReturnRequestDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
