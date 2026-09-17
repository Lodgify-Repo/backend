import { IsEnum, IsOptional, IsString, IsArray, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PropertyAssignmentRole } from '@prisma/client';

export class AssignPropertyStaffDto {
  @ApiPropertyOptional({ description: 'User ID of the manager or agent to assign' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Email address of the manager or agent to assign' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Assignment role on this property (MANAGER or AGENT)',
    enum: PropertyAssignmentRole,
    example: PropertyAssignmentRole.MANAGER,
  })
  @IsEnum(PropertyAssignmentRole)
  role: PropertyAssignmentRole;

  @ApiPropertyOptional({
    description: 'Scoped permissions for this property assignment',
    example: ['MANAGE_BOOKINGS', 'VIEW_FINANCES', 'MANAGE_TENANTS'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class UpdateAssignmentPermissionsDto {
  @ApiProperty({
    description: 'Updated permissions for this assignment',
    example: ['MANAGE_BOOKINGS'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}
