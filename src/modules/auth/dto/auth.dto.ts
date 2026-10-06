import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsPhoneNumber,
  IsEnum,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address',
    example: 'tedlasso@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password (min 8 characters)',
    example: 'SecureP@ss1',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'First name', example: 'Ted' })
  @IsString()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Lasso' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({
    description: 'Phone number (E.164 format)',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({
    description: 'User role',
    enum: Role,
    default: Role.USER,
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role = Role.USER;
}

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'tedlasso@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'User password', example: 'SecureP@ss1' })
  @IsString()
  password: string;
}

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Email address for password reset',
    example: 'tedlasso@gmail.com',
  })
  @IsEmail()
  email: string;
}

export class NewPasswordDto {
  @ApiProperty({ description: 'Reset token issued after OTP verification' })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'New password (min 8 characters)',
    example: 'NewSecureP@ss1',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address the verification code was sent to',
    example: 'tedlasso@gmail.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '6-digit verification code from the email',
    example: '482913',
  })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp: string;
}
