import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CheckoutQuoteDto {
  @ApiProperty()
  @IsString()
  @Matches(/^c[a-z0-9]{20,30}$/)
  addressId!: string;

  @ApiPropertyOptional({ example: 'mock-ghn' })
  @IsOptional()
  @IsString()
  @Matches(/^mock-(?:ghn|ghtk|viettel-post)$/)
  carrierId?: string;

  @ApiPropertyOptional({ example: 'FIGURE10' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  voucherCode?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  redeemPoints?: number;
}

export class PlaceOrderDto extends CheckoutQuoteDto {}
