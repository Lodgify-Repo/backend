import { IsEmail, IsEnum, IsOptional, IsArray, IsString, IsNotEmpty, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InviteSubAccountDto {
  @ApiProperty({ description: 'Email address of the invited sub-account', example: 'manager@hotel.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Organization role for the sub-account',
    enum: [Role.MANAGER, Role.USER],
    default: Role.MANAGER,
    example: Role.MANAGER,
  })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({
    description: 'Whether this sub-account should also have agent access',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isAgent?: boolean;

  @ApiPropertyOptional({
    description: 'Optional property IDs to assign to this sub-account',
    type: [String],
    example: ['uuid-prop-1', 'uuid-prop-2'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyIds?: string[];
}

export class AcceptSubAccountDto {
  @ApiProperty({ description: 'Invitation token', example: 'uuid-token' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
