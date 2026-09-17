import { DomainErrorCode } from '@/common/domain/error';
import { HttpStatus } from '@nestjs/common';

export const AdminErrorCodes = {
  ...DomainErrorCode,
  ACTION_NOT_ALLOWED: 'ACTION_NOT_ALLOWED',
  TARGET_NOT_FOUND: 'TARGET_NOT_FOUND',
  LOG_FILE_NOT_FOUND: 'LOG_FILE_NOT_FOUND',
} as const;

export const AdminErrorMap: Record<string, HttpStatus> = {
  [AdminErrorCodes.ACTION_NOT_ALLOWED]: HttpStatus.FORBIDDEN,
  [AdminErrorCodes.TARGET_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [AdminErrorCodes.LOG_FILE_NOT_FOUND]: HttpStatus.BAD_REQUEST,
};
