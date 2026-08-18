import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { SavedViewsController } from "./saved-views.controller";
import { SavedViewsService } from "./saved-views.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}
