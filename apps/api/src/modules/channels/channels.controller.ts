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
  channelIdParamsSchema,
  createChannelSchema,
  updateChannelSchema,
  workspaceIdParamsSchema,
  type CreateChannelInput,
  type UpdateChannelInput,
} from "@taskmaster/contracts";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import { ZodPipe } from "../../common/pipes/zod.pipe";
import type { AuthUser } from "../auth/types";
import { ChannelsService } from "./channels.service";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);
const channelIdPipe = new ParseIdPipe(channelIdParamsSchema);

@Controller("workspaces/:workspaceId/channels")
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.channelsService.list(workspaceId, user.sub);
  }

  @Post()
  create(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(createChannelSchema)) dto: CreateChannelInput,
  ) {
    return this.channelsService.create(workspaceId, user.sub, dto);
  }

  @Patch(":id")
  update(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", channelIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateChannelSchema)) dto: UpdateChannelInput,
  ) {
    return this.channelsService.update(workspaceId, id, user.sub, dto);
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", channelIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.channelsService.remove(workspaceId, id, user.sub);
  }
}
