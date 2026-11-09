import { IsEnum, IsNumber, IsOptional, IsString, IsArray, IsEmail, IsObject, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Prisma, PropertyCategory, CommissionType, AuthorizationStatus } from '@prisma/client';

export class CreatePropertyDto {
  @ApiProperty({ description: 'Title of the property' })
  @IsString()
  title: string;

  @ApiProperty({ description: 'Category', enum: PropertyCategory })
  @IsEnum(PropertyCategory)
  category: PropertyCategory;

  @ApiProperty({ description: 'Base price or rent/nightly rate', default: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Long-form property description shown on the details page' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Gallery image URLs for the details page', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ description: 'Amenity labels shown as facilities on the details page', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ description: 'Category-specific metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonObject;
}

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

export class AuthorizeAgentDto {
  @ApiPropertyOptional({ description: 'Agent Email (required if agentId is not provided)' })
  @IsOptional()
  @IsEmail()
  agentEmail?: string;

  @ApiPropertyOptional({ description: 'Agent ID (required if agentEmail is not provided)' })
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiProperty({ description: 'Commission type', enum: CommissionType })
  @IsEnum(CommissionType)
  commissionType: CommissionType;

  @ApiProperty({ description: 'Commission value (percent or fixed amount)' })
  @IsNumber()
  @Min(0)
  commissionValue: number;

  @ApiPropertyOptional({ description: 'List of permissions', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class RespondAuthorizationDto {
  @ApiProperty({ description: 'Accept or reject the authorization' })
  accept: boolean;
}
