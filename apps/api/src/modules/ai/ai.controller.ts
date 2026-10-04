import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  assistantRequestSchema,
  nlTaskSchema,
  workspaceIdParamsSchema,
  type AssistantRequest,
  type NlTaskInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { AiService } from "./ai.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);

@Controller("workspaces/:workspaceId/ai")
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post("nl-task")
  nlTask(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(nlTaskSchema)) dto: NlTaskInput,
  ) {
    return this.aiService.generateTaskDraft(workspaceId, user.sub, dto.text);
  }

  @Post("assistant")
  @Throttle({
    default: { limit: 10, ttl: 60_000 },
  })
  assistant(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(assistantRequestSchema)) dto: AssistantRequest,
  ) {
    return this.aiService.assistantStep(workspaceId, user.sub, dto);
  }

  /**
   * Qué hay operativo del lado del servidor, para que el frontend no dibuje el
   * asistente cuando no hay proveedor configurado.
   *
   * Va antes de `usage` a propósito: es la consulta que decide si la UI monta el
   * resto del módulo, y no debería competir por cuota con una que sí pesa.
   */
  @Get("capabilities")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  capabilities(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.aiService.getCapabilities(workspaceId, user.sub);
  }

  @Get("usage")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  usage(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.aiService.getUsage(workspaceId, user.sub);
  }
}
