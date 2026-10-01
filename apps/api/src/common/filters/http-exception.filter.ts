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
    // Este filtro está registrado con useGlobalFilters, así que también recibe
    // excepciones de contextos que no son HTTP (WebSockets de Socket.io, RPC).
    // switchToHttp() sobre esos contextos no da una Response de Express, y
    // terminaría en un TypeError al escribir, que tapa el error original.
    if (host.getType() !== "http") {
      this.logger.error(
        `Excepción en contexto no-HTTP (${host.getType()}):`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }

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
      // Solo se propaga `issues` cuando es un array (formato de Zod: lista de
      // campos con mensaje). Si `message` viniera como array u objeto arbitrario
      // lo descartamos: un HttpException de una librería de terceros podría
      // estar metiendo ahí datos internos de la consulta.
      const issues = Array.isArray(obj.issues) ? obj.issues : undefined;
      return {
        statusCode: status,
        message:
          typeof obj.message === "string" ? obj.message : "Solicitud inválida",
        ...(issues ? { errors: issues } : {}),
        path: request.url,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        // `exception.meta` NO se envía: contiene los valores que violaron el
        // índice único (el email que ya existe, el slug tomado). Con eso, un
        // POST /auth/register que choque por P2002 confirma si una cuenta está
        // registrada. El código alcanza para que el cliente sepa que hay
        // conflicto; el detalle va al log del servidor, no a la respuesta.
        this.logger.warn(
          `P2002 en ${request.method} ${request.url} — meta: ${JSON.stringify(exception.meta)}`,
        );
        return {
          statusCode: HttpStatus.CONFLICT,
          message: "Ya existe un registro con esos datos",
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
