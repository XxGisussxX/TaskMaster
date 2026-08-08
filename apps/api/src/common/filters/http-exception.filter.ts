import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { Response } from "express";

interface ErrorBody {
  statusCode: number;
  message: string;
  errors?: unknown;
  path?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ url: string; method: string }>();

    const body = this.toBody(exception, request);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toBody(
    exception: unknown,
    request: { url: string; method: string },
  ): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        return { statusCode: status, message: res, path: request.url };
      }
      const obj = res as Record<string, unknown>;
      return {
        statusCode: status,
        message:
          typeof obj.message === "string" ? obj.message : "Solicitud inválida",
        errors: obj.issues ?? obj.message,
        path: request.url,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: "Ya existe un registro con esos datos",
          errors: { code: "P2002", meta: exception.meta },
          path: request.url,
        };
      }
      if (exception.code === "P2025") {
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: "Recurso no encontrado",
          path: request.url,
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Error interno del servidor",
      path: request.url,
    };
  }
}
