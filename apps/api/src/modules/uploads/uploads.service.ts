import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Attachment } from "@taskmaster/contracts";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
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

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private cloudinary: unknown = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: WorkspaceAccessService,
  ) {
    this.initCloudinary();
  }

  private async initCloudinary(): Promise<void> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      this.logger.warn(
        "Cloudinary no configurado. Los archivos se guardarÃ¡n solo en la DB (sin almacenamiento real).",
      );
      return;
    }

    try {
      const { v2 } = await import("cloudinary");
      v2.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.cloudinary = v2;
      this.logger.log("Cloudinary configurado correctamente");
    } catch {
      this.logger.warn("No se pudo inicializar Cloudinary");
    }
  }

  validateFile(file: Express.Multer.File): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `El archivo excede el tamaÃ±o mÃ¡ximo de ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}`,
      );
    }
  }

  async upload(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
    context: { taskId?: string; noteId?: string },
  ): Promise<Attachment> {
    await this.access.assertWriteRole(workspaceId, userId);
    if (!file) throw new BadRequestException("Archivo requerido");
    this.validateFile(file);
    await this.assertTargetBelongsToWorkspace(workspaceId, context);

    let url = "";
    let publicId: string | null = null;

    if (this.cloudinary) {
      try {
        const cld = this.cloudinary as typeof import("cloudinary").v2;
        const result = await new Promise<
          import("cloudinary").UploadApiResponse
        >((resolve, reject) => {
          const stream = cld.uploader.upload_stream(
            {
              folder: `taskmaster/${workspaceId}`,
              resource_type: "auto",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result!);
            },
          );
          stream.end(file.buffer);
        });
        url = result.secure_url;
        publicId = result.public_id;
      } catch (err) {
        this.logger.error("Error subiendo a Cloudinary", err);
        throw new BadRequestException("Error al subir el archivo");
      }
    } else {
      url = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    }

    const attachment = await this.prisma.attachment.create({
      data: {
        workspaceId,
        taskId: context.taskId ?? null,
        noteId: context.noteId ?? null,
        userId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        url,
        publicId,
      },
    });

    return {
      id: attachment.id,
      workspaceId: attachment.workspaceId,
      taskId: attachment.taskId,
      noteId: attachment.noteId,
      userId: attachment.userId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      url: attachment.url,
      createdAt: attachment.createdAt.toISOString(),
    };
  }

  private async assertTargetBelongsToWorkspace(
    workspaceId: string,
    context: { taskId?: string; noteId?: string },
  ): Promise<void> {
    if (context.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: context.taskId, workspaceId },
        select: { id: true },
      });
      if (!task) throw new NotFoundException("Tarea no encontrada");
    }
    if (context.noteId) {
      const note = await this.prisma.note.findFirst({
        where: { id: context.noteId, workspaceId },
        select: { id: true },
      });
      if (!note) throw new NotFoundException("Nota no encontrada");
    }
  }

  async list(
    workspaceId: string,
    userId: string,
    context: { taskId?: string; noteId?: string },
  ): Promise<Attachment[]> {
    await this.access.assertMembership(workspaceId, userId);
    await this.assertTargetBelongsToWorkspace(workspaceId, context);

    const where: Record<string, unknown> = { workspaceId };
    if (context.taskId) where.taskId = context.taskId;
    if (context.noteId) where.noteId = context.noteId;

    const attachments = await this.prisma.attachment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return attachments.map((a) => ({
      id: a.id,
      workspaceId: a.workspaceId,
      taskId: a.taskId,
      noteId: a.noteId,
      userId: a.userId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      url: a.url,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async remove(
    workspaceId: string,
    id: string,
    userId: string,
  ): Promise<{ id: string }> {
    await this.access.assertWriteRole(workspaceId, userId);

    const attachment = await this.prisma.attachment.findFirst({
      where: { id, workspaceId },
    });
    if (!attachment) throw new BadRequestException("Archivo no encontrado");

    if (this.cloudinary && attachment.publicId) {
      try {
        const cld = this.cloudinary as typeof import("cloudinary").v2;
        await cld.uploader.destroy(attachment.publicId);
      } catch (err) {
        this.logger.warn("Error eliminando de Cloudinary", err);
      }
    }

    await this.prisma.attachment.delete({ where: { id } });
    return { id };
  }
}
