import { DomainErrorCode } from '@/common/domain/error';
import { HttpStatus } from '@nestjs/common';

export const PropertyErrorCodes = {
  ...DomainErrorCode,
  PROPERTY_NOT_FOUND: 'PROPERTY_NOT_FOUND',
  OWNER_PROFILE_REQUIRED: 'OWNER_PROFILE_REQUIRED',
  AGENT_PROFILE_REQUIRED: 'AGENT_PROFILE_REQUIRED',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  ASSIGNEE_NOT_FOUND: 'ASSIGNEE_NOT_FOUND',
  INVALID_ASSIGNEE: 'INVALID_ASSIGNEE',
  AUTHORIZATION_NOT_FOUND: 'AUTHORIZATION_NOT_FOUND',
  ASSIGNMENT_NOT_FOUND: 'ASSIGNMENT_NOT_FOUND',
  INVALID_AUTHORIZATION_STATE: 'INVALID_AUTHORIZATION_STATE',
} as const;

export const PropertyErrorMap: Record<string, HttpStatus> = {
  [PropertyErrorCodes.PROPERTY_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [PropertyErrorCodes.OWNER_PROFILE_REQUIRED]: HttpStatus.FORBIDDEN,
  [PropertyErrorCodes.AGENT_PROFILE_REQUIRED]: HttpStatus.BAD_REQUEST,
  [PropertyErrorCodes.AGENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [PropertyErrorCodes.ASSIGNEE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [PropertyErrorCodes.INVALID_ASSIGNEE]: HttpStatus.BAD_REQUEST,
  [PropertyErrorCodes.AUTHORIZATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [PropertyErrorCodes.ASSIGNMENT_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [PropertyErrorCodes.INVALID_AUTHORIZATION_STATE]: HttpStatus.CONFLICT,
};
