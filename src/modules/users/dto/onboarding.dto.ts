import { IsEnum, IsOptional, IsString, IsNumber, Min, Length, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AgentCredentialType, AgentType, OnboardingIntent } from '@prisma/client';

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

  @ApiProperty({
    description: 'Credential supplied to verify the agent',
    enum: AgentCredentialType,
  })
  @IsEnum(AgentCredentialType)
  credentialType: AgentCredentialType;

  @ApiProperty({
    description: 'CAC, SCUML, ESVARBON/NIESV, or state permit number',
    example: 'RC1234567',
  })
  @IsString()
  @Length(3, 100)
  @Matches(/[A-Za-z0-9]/, {
    message: 'credentialNumber must contain at least one letter or number',
  })
  credentialNumber: string;

  @ApiPropertyOptional({ description: 'Default commission rate percent (e.g. 10 for 10%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultCommissionRate?: number;
}
