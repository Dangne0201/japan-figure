import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Availability, CatalogSort } from '../catalog-query';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

const toOptionalString = ({ value }: { value: unknown }): unknown =>
  value === '' ? undefined : value;

const toOptionalNumber = ({ value }: { value: unknown }): unknown =>
  value === '' ? undefined : Number(value);

export class CatalogQueryDto {
  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  brand?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  series?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(toOptionalString)
  @IsString()
  scale?: string;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(2000)
  @Max(2100)
  releaseYear?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Transform(toOptionalNumber)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Transform(toOptionalString)
  @IsIn(['in-stock', 'sold-out'])
  availability?: Availability;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  preorder?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  newArrival?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  saleOnly?: boolean;

  @IsOptional()
  @Transform(toOptionalString)
  @IsIn(['newest', 'price-asc', 'price-desc', 'name-asc'])
  sort?: CatalogSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(48)
  limit = 12;
}

export class SearchSuggestionQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
