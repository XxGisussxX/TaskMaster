import { Controller, Get, Param, Query } from "@nestjs/common";
import {
  agendaReviewQuerySchema,
  workspaceIdParamsSchema,
  type AgendaReviewQuery,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { AgendaService } from "./agenda.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);

/**
 * Revisión de agenda.
 *
 * Va en su propio módulo y no dentro de `ai/` a propósito aunque la tarjeta
 * live en el dashboard: esto es cálculo determinista sobre las tareas, no
 * inferencia. Mantenerlos separados permite que un resumen del modelo se sume
 * al lado después sin mezclar las dos cosas.
 */
@Controller("workspaces/:workspaceId/agenda-review")
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  review(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query(new ZodPipe(agendaReviewQuerySchema)) query: AgendaReviewQuery,
  ) {
    return this.agendaService.review(workspaceId, user.sub, query);
  }
}
