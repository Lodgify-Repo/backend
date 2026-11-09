import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Check-in date in ISO 8601 format',
    example: '2026-12-20',
  })
  @IsDateString()
  checkInDate: string;

  @ApiProperty({
    description: 'Number of nights being booked',
    example: 2,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nights: number;

  @ApiPropertyOptional({
    description: 'Number of guests',
    example: 2,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests?: number;
}
