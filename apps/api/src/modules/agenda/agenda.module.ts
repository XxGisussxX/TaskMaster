import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { AgendaController } from "./agenda.controller";
import { AgendaService } from "./agenda.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
