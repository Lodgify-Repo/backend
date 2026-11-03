import { Type } from 'class-transformer';
import {IsEnum,IsNumber,IsOptional,IsString,Max,Min,} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyCategory } from '@prisma/client';

export class SearchPropertiesDto {
  @ApiPropertyOptional({
    description: 'Free-text query matched against title, type and location',
    example: 'victoria island',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Property category',
    enum: PropertyCategory,
  })
  @IsOptional()
  @IsEnum(PropertyCategory)
  category?: PropertyCategory;

  @ApiPropertyOptional({
    description: 'Comma-separated categories, takes precedence over category',
    example: 'HOTEL,SHORTLET',
  })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiPropertyOptional({
    description: 'Category of specific property type stored in metadata',
    example: 'hotel',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Minimum guest rating (0 - 5)',
    example: 4,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Minimum price (inclusive)', example: 50000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price (inclusive)', example: 300000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Latitude for proximity search', example: 6.4281 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude for proximity search', example: 3.4219 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Maximum number of results', default: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}
