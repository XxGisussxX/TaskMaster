import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

/**
 * Cliente Redis de la aplicación.
 *
 * Global por el mismo motivo que `PrismaModule`: es infraestructura única
 * compartida por módulos que no deberían conocer su existencia. Además
 * `ThrottlerModule.forRootAsync` la inyecta desde `AppModule`, así que tiene que
 * estar disponible sin que cada módulo la importe explícitamente.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
