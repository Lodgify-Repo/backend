import { IsEnum, IsString, IsOptional, IsArray, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({ description: 'New user account status', enum: ['ACTIVE', 'SUSPENDED', 'BANNED'] })
  @IsEnum(['ACTIVE', 'SUSPENDED', 'BANNED'])
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';

  @ApiPropertyOptional({ description: 'Reason for status change', example: 'Violation of terms of service' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateApiKeyDto {
  @ApiProperty({ description: 'Name or description of the API Key', example: 'Production Integration Key' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Tenant identifier associated with the API key', example: 'tenant-123' })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({ description: 'Tier level', enum: ['standard', 'enterprise'], default: 'standard' })
  @IsOptional()
  @IsString()
  tier?: string = 'standard';

  @ApiPropertyOptional({ description: 'Permissions granted to this API key', example: ['read', 'write'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[] = [];

  @ApiPropertyOptional({ description: 'Expiration date in ISO format', example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
