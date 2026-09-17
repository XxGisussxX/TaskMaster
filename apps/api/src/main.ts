import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  const config = app.get(ConfigService);

  const origins = (config.get<string>("API_ORIGINS") ?? "*")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const allowAllOrigins = origins.length === 0 || origins.includes("*");
  app.enableCors({
    origin: allowAllOrigins ? true : origins,
    credentials: !allowAllOrigins,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(helmet());
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  app.set("trust proxy", 1);

  const port = config.get<number>("API_PORT") ?? 4000;
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api`, "Bootstrap");
}

void bootstrap();
