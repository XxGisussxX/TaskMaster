import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Logger as PinoLogger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { writeSync } from "node:fs";
import { AppModule } from "./app.module";
import { describeBootstrapFailure } from "./bootstrap-failure";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { resolveCorsOptions } from "./config/cors";
import {
  installUnhandledRejectionGuard,
  type UncaughtReporter,
} from "./redis/unhandled-rejection-guard";

/**
 * Escribe directo al proceso, sin pasar por Nest ni por los buffers de Node.
 *
 * `writeSync` y no `console.*`: cuando la salida es una tubería —que es
 * exactamente como `pnpm dev` la ve— las escrituras de stdout son asíncronas y
 * `process.exit()` descarta lo que esté pendiente. Con Redis caído eso producía
 * un fallo mudo: código 1 y ninguna pantalla, que es la peor forma de fallar.
 */
const uncaughtReporter: UncaughtReporter = {
  warn: (message) => writeSync(1, `${message}\n`),
  error: (message) => writeSync(2, `${message}\n`),
};

async function bootstrap(): Promise<void> {
  // Antes de crear la app: si algo se rechaza mientras se arma el árbol de
  // providers, el handler tiene que estar puesto para no matar el proceso con un
  // error que Nest todavía no sabe formatear.
  //
  // Se registra antes que el reporter de Nest a propósito: durante el
  // `NestFactory.create()`, `bufferLogs` deja el `Logger` de Nest esperando a un
  // `app.useLogger()` que, si el create falla, nunca llega. Un rechazo en esa
  // ventana se perdería junto con el resto del buffer.
  installUnhandledRejectionGuard(uncaughtReporter);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  app.useLogger(app.get(PinoLogger));

  // Fail-closed: resolveCorsOptions lanza si allowAllOrigins se cuela en producción.
  // validateEnv también lo rechaza; esta es la segunda barrera, para el caso de
  // que el config no haya pasado por el schema.
  app.enableCors(
    resolveCorsOptions(
      config.get<string>("API_ORIGINS"),
      config.get<string>("NODE_ENV"),
    ),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(helmet());
  // Necesario para que `req.cookies` exista: el refresh token viaja en una
  // cookie HttpOnly en lugar de volver en el cuerpo de la respuesta.
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();

  // `trust proxy` decide qué entrada de X-Forwarded-For se cree el cliente.
  // Con un valor incorrecto, el visitante controla el IP que ve el throttler y
  // puede rotar el header para evadir el rate limit. Por defecto 0 (sin proxy).
  app.set("trust proxy", config.get<number>("TRUST_PROXY") ?? 0);

  const port = config.get<number>("API_PORT") ?? 4000;
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api`, "Bootstrap");
}

// El fallo de arranque se maneja explícitamente y no se deja llegar al handler
// global de `unhandledRejection`. Ese handler existe para los rechazos de Redis
// que ioredis deja sin dueño en runtime, y su criterio absorbe `ECONNREFUSED` y
// compañía: si el arranque fallara por falta de Redis, se lo tragaría sin
// loguear nada y cortaría con código 0, que es el modo de falla más difícil de
// diagnosticar. Acá se reporta en voz alta y se corta con código 1.
void bootstrap().catch((error: unknown) => {
  writeSync(2, `${describeBootstrapFailure(error)}\n`);
  process.exit(1);
});
