import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["log", "error", "warn", "debug"],
  });

  const config = app.get(ConfigService);

  const origins = config
    .get<string>("API_ORIGINS")
    ?.split(",")
    .map((s) => s.trim()) ?? ["*"];
  app.enableCors({
    origin: origins.includes("*") ? true : origins,
    credentials: true,
  });

  app.use(helmet());
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  app.set("trust proxy", 1);

  const port = config.get<number>("API_PORT") ?? 4000;
  await app.listen(port);
  Logger.log(`API escuchando en http://localhost:${port}/api`, "Bootstrap");
}

void bootstrap();
