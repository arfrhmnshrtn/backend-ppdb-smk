import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Terjadi kesalahan pada server';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse: any = exception.getResponse();
      message = exceptionResponse.message || exception.message;
    }

    // Format response yang konsisten
    response.status(status).json({
      success: false,
      message: Array.isArray(message) ? message[0] : message, // Ambil pesan pertama jika array (dari class-validator)
      data: null,
    });
  }
}
