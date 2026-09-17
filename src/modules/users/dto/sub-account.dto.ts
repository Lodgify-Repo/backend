import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class InviteSubAccountDto {
  @ApiProperty({ description: 'Email of the staff member' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Role assigned to the staff', enum: Role })
  @IsEnum(Role)
  role: Role;
}
