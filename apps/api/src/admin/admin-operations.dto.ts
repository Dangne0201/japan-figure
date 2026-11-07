import { VoucherType, OrderStatus, ReviewStatus, ReturnStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const normalizeCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

abstract class PageQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class AdminOrderListDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}

export class AdminReviewListDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsOptional()
  @IsEnum(ReviewStatus)
  status?: ReviewStatus;
}

export class AdminCustomerListDto extends PageQueryDto {
  @ApiPropertyOptional({ description: 'Filter active, disabled, or all customers' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @Matches(/^(active|disabled|all)$/u)
  state: 'active' | 'disabled' | 'all' = 'active';
}

export class AdminAuditListDto extends PageQueryDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(80)
  action?: string;
}

export class UpdateReviewStatusDto {
  @ApiProperty({ enum: [ReviewStatus.APPROVED, ReviewStatus.REJECTED] })
  @IsEnum([ReviewStatus.APPROVED, ReviewStatus.REJECTED])
  status!: 'APPROVED' | 'REJECTED';
}

export class SetCustomerDisabledDto {
  @ApiProperty()
  @IsBoolean()
  disabled!: boolean;
}

export class AdminOrderActionDto {
  @ApiProperty({ maxLength: 500 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class ResolveAdminReturnDto extends AdminOrderActionDto {
  @ApiProperty({ enum: [ReturnStatus.COMPLETED, ReturnStatus.REJECTED] })
  @IsEnum([ReturnStatus.COMPLETED, ReturnStatus.REJECTED])
  status!: 'COMPLETED' | 'REJECTED';
}

export class AdminVoucherFieldsDto {
  @ApiProperty({ maxLength: 40 })
  @Transform(normalizeCode)
  @IsString()
  @Matches(/^[A-Z0-9][A-Z0-9_-]{0,39}$/u)
  code!: string;

  @ApiProperty({ enum: VoucherType })
  @IsEnum(VoucherType)
  type!: VoucherType;

  @ApiProperty({ minimum: 0, maximum: 2_000_000_000 })
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  value!: number;

  @ApiProperty({ minimum: 0, maximum: 2_000_000_000 })
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  minSubtotalVnd!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 2_000_000_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  maxDiscountVnd?: number | null;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  expiresAt!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  totalLimit?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 100_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  perUserLimit?: number | null;

  @ApiProperty()
  @IsBoolean()
  isStackable!: boolean;
}

export class CreateAdminVoucherDto extends AdminVoucherFieldsDto {}

export class UpdateAdminVoucherDto extends PartialType(AdminVoucherFieldsDto) {}

export class AdminBannerFieldsDto {
  @ApiProperty({ maxLength: 160 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ maxLength: 500, description: 'Same-origin relative asset path' })
  @Transform(trimString)
  @IsString()
  @Matches(/^\/(?!\/)[A-Za-z0-9/_.,?=&%#-]+$/u)
  @MaxLength(500)
  imageUrl!: string;

  @ApiProperty({ maxLength: 500, description: 'Same-origin relative destination path' })
  @Transform(trimString)
  @IsString()
  @Matches(/^\/(?!\/)[A-Za-z0-9/_.,?=&%#-]+$/u)
  @MaxLength(500)
  href!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ minimum: 0, maximum: 100000 })
  @IsInt()
  @Min(0)
  @Max(100_000)
  sortOrder!: number;

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}

export class CreateAdminBannerDto extends AdminBannerFieldsDto {}

export class UpdateAdminBannerDto extends PartialType(AdminBannerFieldsDto) {}
