import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ParseIdPipe } from "../../common/pipes/parse-id.pipe";
import type { AuthUser } from "../auth/types";
import { UploadsService } from "./uploads.service";
import { z } from "zod";

const workspaceIdPipe = new ParseIdPipe(
  z.object({ id: z.string().cuid("ID de workspace inválido") }),
);

const attachmentIdPipe = new ParseIdPipe(
  z.object({ id: z.string().cuid("ID de archivo inválido") }),
);

@Controller("workspaces/:workspaceId/uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
    @Query("taskId") taskId?: string,
    @Query("noteId") noteId?: string,
  ) {
    return this.uploadsService.upload(workspaceId, user.sub, file, {
      taskId,
      noteId,
    });
  }

  @Get()
  list(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @CurrentUser() user: AuthUser,
    @Query("taskId") taskId?: string,
    @Query("noteId") noteId?: string,
  ) {
    return this.uploadsService.list(workspaceId, user.sub, {
      taskId,
      noteId,
    });
  }

  @Delete(":id")
  remove(
    @Param("workspaceId", workspaceIdPipe) workspaceId: string,
    @Param("id", attachmentIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.uploadsService.remove(workspaceId, id, user.sub);
  }
}
