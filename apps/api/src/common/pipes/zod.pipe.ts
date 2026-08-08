import {
  BadRequestException,
  Injectable,
  type PipeTransform,
} from "@nestjs/common";
import type { z, ZodType } from "zod";

/**
 * Valida el cuerpo o la query de una petición contra un schema Zod
 * (definidos en @taskmaster/contracts) y devuelve el dato tipado.
 */
@Injectable()
export class ZodPipe<T extends ZodType> implements PipeTransform<
  unknown,
  z.infer<T>
> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const first = result.error.issues[0];
      throw new BadRequestException({
        message: first?.message ?? "Datos inválidos",
        path: first?.path,
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
