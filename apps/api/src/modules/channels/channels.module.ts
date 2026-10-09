import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";

@Module({
  // WorkspacesModule es quien exporta WorkspaceAccessService; sin este import el
  // arranque falla con UnknownDependenciesException en ChannelsService.
  imports: [WorkspacesModule],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
