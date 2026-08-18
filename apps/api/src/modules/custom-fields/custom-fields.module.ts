import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { CustomFieldsController } from "./custom-fields.controller";
import { CustomFieldsService } from "./custom-fields.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
