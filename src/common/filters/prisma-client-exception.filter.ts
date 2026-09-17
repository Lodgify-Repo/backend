import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message;

    switch (exception.code) {
      case 'P2002': 
        status = HttpStatus.CONFLICT;
        message = 'Resource already exists';
        break;
      case 'P2025': 
        status = HttpStatus.NOT_FOUND;
        message = 'Record not found';
        break;
      
    }

    this.logger.warn(`PrismaError [${exception.code}]: ${exception.message}`);

    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message,
      meta: exception.meta,
    });
  }
}
