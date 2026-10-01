import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { AiProvider } from "./ai.types";
import { GeminiProvider } from "./gemini.provider";

@Global()
@Module({
  imports: [WorkspacesModule],
  controllers: [AiController],
  providers: [
    {
      provide: AiProvider,
      useFactory: (config: ConfigService) =>
        new GeminiProvider({
          apiKey: config.get<string>("GEMINI_API_KEY"),
          model: config.get<string>("GEMINI_MODEL") ?? "gemini-3.6-flash",
          embeddingModel:
            config.get<string>("GEMINI_EMBEDDING_MODEL") ??
            "text-embedding-004",
        }),
      inject: [ConfigService],
    },
    AiService,
  ],
  exports: [AiProvider, AiService],
})
export class AiModule {}
