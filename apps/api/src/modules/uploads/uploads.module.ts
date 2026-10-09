import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { ImageUploadsController } from "./image-uploads.controller";
import { UploadsController } from "./uploads.controller";
import { UploadsService } from "./uploads.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [UploadsController, ImageUploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
