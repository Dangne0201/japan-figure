import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
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
const normalizeSlug = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class AdminProductListDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  q?: string;

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
}

export class AdminProductFieldsDto {
  @ApiProperty({ maxLength: 180 })
  @Transform(normalizeSlug)
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)
  @MaxLength(180)
  slug!: string;

  @ApiProperty({ maxLength: 240 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  name!: string;

  @ApiProperty({ maxLength: 160 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  characterName!: string;

  @ApiProperty({ maxLength: 10000 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  description!: string;

  @ApiProperty({ minimum: 1, maximum: 2_000_000_000 })
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  priceVnd!: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 2_000_000_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  salePriceVnd?: number | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(30)
  scale?: string | null;

  @ApiProperty({ maxLength: 100 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  material!: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  releaseDate?: string | null;

  @ApiProperty({ maxLength: 20 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Matches(/^[A-Za-z0-9-]+$/u)
  janCode!: string;

  @ApiProperty()
  @IsBoolean()
  isPreorder!: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 2_000_000_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  preorderDepositVnd?: number | null;

  @ApiProperty()
  @IsBoolean()
  isFeatured!: boolean;

  @ApiProperty()
  @IsBoolean()
  isNewArrival!: boolean;

  @ApiProperty()
  @IsBoolean()
  published!: boolean;

  @ApiProperty({ description: 'Existing brand CUID' })
  @IsString()
  @Matches(/^c[a-z0-9]{20,30}$/u)
  brandId!: string;

  @ApiProperty({ description: 'Existing series CUID' })
  @IsString()
  @Matches(/^c[a-z0-9]{20,30}$/u)
  seriesId!: string;

  @ApiProperty({ type: [String], description: 'At least one existing category CUID' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @Matches(/^c[a-z0-9]{20,30}$/u, { each: true })
  categoryIds!: string[];
}

export class CreateAdminProductDto extends AdminProductFieldsDto {
  @ApiProperty({ maxLength: 80 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9._-]+$/u)
  sku!: string;

  @ApiProperty({ maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  variantName!: string;

  @ApiProperty({ minimum: 1, maximum: 100000 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  weightGrams!: number;

  @ApiProperty({ minimum: 0, maximum: 1000000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockOnHand!: number;
}

export class UpdateAdminProductDto extends PartialType(AdminProductFieldsDto) {}

export class SetProductStockDto {
  @ApiProperty({ minimum: 0, maximum: 1000000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stockOnHand!: number;
}
