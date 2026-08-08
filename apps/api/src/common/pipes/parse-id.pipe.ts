import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import type { ZodObject, ZodRawShape } from "zod";

/**
 * Valida un valor (string) contra un schema de objeto `{ id }` usado en rutas
 * con parámetro `:id`.
 */
@Injectable()
export class ParseIdPipe implements PipeTransform<string, string> {
  constructor(private readonly schema: ZodObject<ZodRawShape>) {}

  transform(value: string): string {
    const result = this.schema.safeParse({ id: value });
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "ID inválido";
      throw new BadRequestException(message);
    }
    return result.data.id;
  }
}
