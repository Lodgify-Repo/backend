import { IsEmail, IsEnum, IsOptional, IsArray, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InviteSubAccountDto {
  @ApiProperty({ description: 'Email address of the invited sub-account', example: 'manager@hotel.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Sub-account role (e.g., MANAGER or USER)',
    enum: [Role.MANAGER, Role.USER],
    default: Role.MANAGER,
    example: Role.MANAGER,
  })
  @IsEnum(Role)
  role: Role;

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
