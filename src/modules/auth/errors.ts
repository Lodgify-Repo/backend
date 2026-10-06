import { DomainErrorCode } from '@/common/domain/error';
import { HttpStatus } from '@nestjs/common';

export const AuthErrorCodes = {
  ...DomainErrorCode,
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_OTP: 'INVALID_OTP',
  OTP_EXPIRED: 'OTP_EXPIRED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
} as const;

export const AuthErrorMap: Record<string, HttpStatus> = {
  [AuthErrorCodes.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
  [AuthErrorCodes.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AuthErrorCodes.USER_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [AuthErrorCodes.INVALID_TOKEN]: HttpStatus.UNAUTHORIZED,
  [AuthErrorCodes.INVALID_OTP]: HttpStatus.UNAUTHORIZED,
  [AuthErrorCodes.OTP_EXPIRED]: HttpStatus.GONE,
  [AuthErrorCodes.ACCOUNT_DISABLED]: HttpStatus.FORBIDDEN,
};
