import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  createDreamPinSchema,
  pinIdParamsSchema,
  updateDreamBoardSchema,
  updateDreamPinSchema,
  workspaceIdParamsSchema,
  type CreateDreamPinInput,
  type UpdateDreamBoardInput,
  type UpdateDreamPinInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { DreamBoardService } from "./dream-board.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);
const pinIdPipe = new ParseIdPipe(pinIdParamsSchema);

@Controller("workspaces/:workspaceId/dream-board")
export class DreamBoardController {
  constructor(private readonly dreamBoardService: DreamBoardService) {}

  @Get()
  getBoard(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dreamBoardService.getBoard(workspaceId, user.sub);
  }

  @Patch()
  updateBoard(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateDreamBoardSchema)) dto: UpdateDreamBoardInput,
  ) {
    return this.dreamBoardService.updateBoard(workspaceId, user.sub, dto);
  }

  @Post("pins")
  createPin(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createDreamPinSchema)) dto: CreateDreamPinInput,
  ) {
    return this.dreamBoardService.createPin(workspaceId, user.sub, dto);
  }

  @Patch("pins/:pinId")
  updatePin(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("pinId", pinIdPipe) pinId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateDreamPinSchema)) dto: UpdateDreamPinInput,
  ) {
    return this.dreamBoardService.updatePin(workspaceId, pinId, user.sub, dto);
  }

  @Delete("pins/:pinId")
  removePin(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("pinId", pinIdPipe) pinId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.dreamBoardService.removePin(workspaceId, pinId, user.sub);
  }
}
