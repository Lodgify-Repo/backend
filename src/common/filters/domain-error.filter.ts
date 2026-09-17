import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, DomainErrorCode } from '../domain/error';


const globalErrorMap = new Map<string, HttpStatus>([
  [DomainErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND],
  [DomainErrorCode.RESOURCE_ALREADY_EXISTS, HttpStatus.CONFLICT],
  [DomainErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED],
  [DomainErrorCode.VALIDATION_FAILED, HttpStatus.BAD_REQUEST],
  [DomainErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN],
]);


export function registerErrorMap(map: Record<string, HttpStatus>): void {
  for (const [code, status] of Object.entries(map)) {
    globalErrorMap.set(code, status);
  }
}

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  catch(exception: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      globalErrorMap.get(exception.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.warn(
      `DomainError [${exception.code}]: ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
      ...(exception.meta ? { meta: exception.meta } : {}),
    });
  }
}
