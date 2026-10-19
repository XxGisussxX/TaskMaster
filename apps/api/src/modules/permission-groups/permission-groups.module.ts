import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { PermissionGroupsController } from "./permission-groups.controller";
import { PermissionGroupsService } from "./permission-groups.service";

@Module({
  imports: [WorkspacesModule],
  providers: [PermissionGroupsService],
  controllers: [PermissionGroupsController],
  exports: [PermissionGroupsService],
})
export class PermissionGroupsModule {}
