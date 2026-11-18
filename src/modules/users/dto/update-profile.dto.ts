import { Equals, IsOptional, IsPhoneNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Phone number (E.164 format)', example: '+2348012345678' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'Set to null to remove the current avatar',
    nullable: true,
  })
  @IsOptional()
  @Equals(null)
  avatarUrl?: null;
}
