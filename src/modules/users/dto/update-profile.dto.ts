import { IsOptional, IsPhoneNumber, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Phone number (E.164 format)', example: '+2348012345678' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string | null;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://storage.example.com/avatars/john.png' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string | null;
}
