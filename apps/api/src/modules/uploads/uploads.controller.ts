import {
  BadRequestException,
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
import { workspaceIdParamsSchema } from "@taskmaster/contracts";
import { z } from "zod";

const workspaceIdPipe = new ParseIdPipe(workspaceIdParamsSchema);

const attachmentIdPipe = new ParseIdPipe(
  z.object({ id: z.string().cuid("ID de archivo inválido") }),
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Multer en memoria con `limits`: sin esto el archivo entero (y el resto del
 * body) se acumula en RAM antes de que corra cualquier validación, así que el
 * `validateFile` del servicio llega tarde para proteger el proceso.
 *
 * `fileSize` corta el stream al superarse y `files: 1` rechaza los extras en el
 * parser, que es donde zod y el service todavía no intervienen.
 */
const UPLOAD_LIMITS = { fileSize: MAX_FILE_SIZE, files: 1, fields: 10 };

/**
 * Filtro temprano por mimetype declarado. Es solo una primera barrera para no
 * cargar en memoria algo que ya se sabe inválido: la verificación que decide es
 * la de magic bytes en `UploadsService.validateFile`, porque el header
 * Content-Type lo elige el cliente.
 */
function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/json",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]);
  if (!allowed.has(file.mimetype)) {
    cb(
      new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`),
      false,
    );
    return;
  }
  cb(null, true);
}

@Controller("workspaces/:workspaceId/uploads")
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", { limits: UPLOAD_LIMITS, fileFilter }),
  )
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
