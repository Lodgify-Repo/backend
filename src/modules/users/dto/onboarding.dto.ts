import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentType, OnboardingIntent } from '@prisma/client';

export class CompleteOnboardingDto {
  @ApiProperty({ description: 'Initial onboarding intent', enum: OnboardingIntent })
  @IsEnum(OnboardingIntent)
  intent: OnboardingIntent;
}

export class ActivateOwnerProfileDto {
  @ApiPropertyOptional({ description: 'Business or legal name', example: 'Lodgify LLC' })
  @IsOptional()
  @IsString()
  businessName?: string;
}

export class ActivateAgentProfileDto {
  @ApiProperty({ description: 'Agency type', enum: AgentType })
  @IsEnum(AgentType)
  agencyType: AgentType;

  @ApiPropertyOptional({ description: 'Name of the organization if applicable' })
  @IsOptional()
  @IsString()
  organizationName?: string;

  @ApiPropertyOptional({ description: 'Professional license number' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ description: 'Default commission rate percent (e.g. 10 for 10%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultCommissionRate?: number;
}
