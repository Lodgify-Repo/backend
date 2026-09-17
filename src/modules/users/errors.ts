import { DomainErrorCode } from '@/common/domain/error';
import { HttpStatus } from '@nestjs/common';

export const UserErrorCodes = {
  ...DomainErrorCode,
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  INVALID_PROFILE_DATA: 'INVALID_PROFILE_DATA',
  PROFILE_ALREADY_EXISTS: 'PROFILE_ALREADY_EXISTS',
  ONBOARDING_ALREADY_COMPLETED: 'ONBOARDING_ALREADY_COMPLETED',
} as const;

export const UserErrorMap: Record<string, HttpStatus> = {
  [UserErrorCodes.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [UserErrorCodes.INVALID_PROFILE_DATA]: HttpStatus.BAD_REQUEST,
  [UserErrorCodes.PROFILE_ALREADY_EXISTS]: HttpStatus.CONFLICT,
  [UserErrorCodes.ONBOARDING_ALREADY_COMPLETED]: HttpStatus.CONFLICT,
};
