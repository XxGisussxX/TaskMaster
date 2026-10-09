import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { DreamBoardController } from "./dream-board.controller";
import { DreamBoardService } from "./dream-board.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [DreamBoardController],
  providers: [DreamBoardService],
  exports: [DreamBoardService],
})
export class DreamBoardModule {}
