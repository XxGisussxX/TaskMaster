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
/** Límite propio del endpoint de imágenes sueltas (pins, documentos). */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
const ALLOWED_MIME_TYPES = new Set([
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

/**
 * Firmas (magic bytes) por tipo binario permitido.
 *
 * `file.mimetype` lo elige el cliente: mandar `Content-Type: image/png` con un
 * HTML cualquiera lo pasa sin problema. Estos bytes son del contenido, así que
 * no se pueden mentir.
 *
 * Nota: los formatos de Office (.docx/.xlsx) son contenedores ZIP, así que
 * comparten la firma PK. Es indistinguible de un .zip a nivel de bytes y por eso
 * ambos siguen permitidos.
 */
const MAGIC_BYTES: ReadonlyArray<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
];

/** RIFF....WEBP — la extensión va en los bytes 8..11, no al principio. */
const WEBP_RIFF = [0x57, 0x45, 0x42, 0x50];

/** Formatos declarados como texto: no tienen firma, se validan por contenido. */
const TEXTUAL_MIME_TYPES = new Set([
  "text/plain",
  "text/csv",
  "application/json",
]);

/**-family de Office que son ZIP. */
const ZIP_BASED_MIME_TYPES = new Set([
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return bytes.every((byte, i) => buffer[i] === byte);
}

function looksBinary(buffer: Buffer): boolean {
  // El byte NUL no aparece en texto UTF-8 válido y sí en casi todo binario.
  return buffer.subarray(0, Math.min(buffer.length, 4096)).includes(0);
}

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
        `El archivo excede el tamaño máximo de ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}`,
      );
    }

    const buffer = file.buffer;
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException("Archivo vacío");
    }

    // WebP: la marca "WEBP" no está al principio, vive en los bytes 8..11.
    if (file.mimetype === "image/webp") {
      if (buffer.length < 12) {
        throw new BadRequestException("Archivo corrupto: image/webp");
      }
      const riff = startsWith(buffer, [0x52, 0x49, 0x46, 0x46]);
      const webp = WEBP_RIFF.every((b, i) => buffer[8 + i] === b);
      if (!riff || !webp) {
        throw new BadRequestException("Firma inválida para image/webp");
      }
      return;
    }

    // .docx / .xlsx / .zip son el mismo contenedor ZIP: firma PK\x03\x04.
    if (ZIP_BASED_MIME_TYPES.has(file.mimetype)) {
      if (!startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
        throw new BadRequestException(`Firma inválida para ${file.mimetype}`);
      }
      return;
    }

    // Los tipos textuales no tienen firma: se validan por contenido.
    if (TEXTUAL_MIME_TYPES.has(file.mimetype)) {
      if (looksBinary(buffer)) {
        throw new BadRequestException(
          `El contenido del archivo no coincide con ${file.mimetype}`,
        );
      }
      return;
    }

    const match = MAGIC_BYTES.find((m) => startsWith(buffer, m.bytes));
    if (!match) {
      throw new BadRequestException(
        `Firma de archivo no reconocida para ${file.mimetype}`,
      );
    }
    if (match.mime !== file.mimetype) {
      throw new BadRequestException(
        `El contenido del archivo es ${match.mime}, no ${file.mimetype}`,
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file) throw new BadRequestException("Archivo requerido");
    if (file.size > MAX_IMAGE_SIZE) {
      throw new BadRequestException(
        `La imagen excede el tamaño máximo de ${MAX_IMAGE_SIZE / 1024 / 1024} MB`,
      );
    }
    if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Solo se permiten imágenes (JPG, PNG, WebP, GIF): ${file.mimetype}`,
      );
    }

    // Validación decidida por magic bytes (no por la extensión ni por el
    // Content-Type, que elige el cliente).
    this.validateFile(file);

    // El nombre original no se usa como ruta de almacenamiento: el archivo
    // llega a Cloudinary por stream desde memoria (public_id autogenerado), así
    // que un nombre con traversal (`../../etc`) o caracteres raros nunca toca el
    // filesystem ni forma parte de la URL pública.
    let url: string;
    if (this.cloudinary) {
      try {
        const cld = this.cloudinary as typeof import("cloudinary").v2;
        const result = await new Promise<
          import("cloudinary").UploadApiResponse
        >((resolve, reject) => {
          const stream = cld.uploader.upload_stream(
            {
              folder: "taskmaster/images",
              resource_type: "image",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result!);
            },
          );
          stream.end(file.buffer);
        });
        url = result.secure_url;
      } catch (err) {
        this.logger.error("Error subiendo imagen a Cloudinary", err);
        throw new BadRequestException("Error al subir la imagen");
      }
    } else {
      url = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    }

    return { url };
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

  /**
   * Destruye un asset de Cloudinary a partir de su URL pública.
   *
   * A diferencia de `remove`, acá no hay fila `Attachment` de la que sacar el
   * `publicId`: el DreamBoard guarda solo la `url` en el pin. Se deriva el
   * `public_id` de la URL (`.../upload/v<ts>/<folder>/<id>.<ext>` → `<folder>/<id>`)
   * y se ignora en silencio lo que no sea una URL de Cloudinary: las imágenes en
   * `data:` base64 (fallback sin Cloudinary) y las externas no se pueden borrar
   * del origen y no deben romper la operación.
   */
  async destroyImageByUrl(url: string | null | undefined): Promise<void> {
    if (!this.cloudinary || !url) return;
    if (!/res\.cloudinary\.com/.test(url)) return;

    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
    if (!match?.[1]) return;

    try {
      const cld = this.cloudinary as typeof import("cloudinary").v2;
      await cld.uploader.destroy(match[1], { resource_type: "image" });
    } catch (err) {
      this.logger.warn("Error eliminando imagen de Cloudinary", err);
    }
  }
}
