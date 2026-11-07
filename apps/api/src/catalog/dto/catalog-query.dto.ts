import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { Availability, CatalogSort } from '../catalog-query';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class CatalogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  series?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  scale?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
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
