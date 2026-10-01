import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { resolveCorsOptions } from "./config/cors";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  const config = app.get(ConfigService);

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

void bootstrap();
