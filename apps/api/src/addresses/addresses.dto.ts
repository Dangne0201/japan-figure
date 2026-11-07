import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AddressInputDto {
  @ApiProperty({ example: 'Nhà riêng' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label!: string;

  @ApiProperty({ example: 'Nguyễn Minh Anh' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  recipientName!: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @Matches(/^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/)
  phone!: string;

  @ApiProperty({ example: '12 Nguyễn Trãi, khu phố 3' })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  streetAddress!: string;

  @ApiProperty({ example: '79' })
  @IsString()
  @Matches(/^\d{2}$/)
  provinceCode!: string;

  @ApiProperty({ example: '26734' })
  @IsString()
  @Matches(/^\d{5}$/)
  communeCode!: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
