import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { UploadsService } from "./uploads.service";

/**
 * Una imagen subida de forma suelta (sin un workspace de contexto, a
 * diferencia de los adjuntos): devuelve una URL pública lista para guardarse
 * en el campo `imageUrl` de un pin, documento, etc.
 *
 * El `JwtAuthGuard` global ya exige sesión; el `@Throttle` acota el consumo de
 * almacenamiento por usuario y por minuto.
 */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Primera barrera en el parser de Multer: solo deja pasar imágenes declaradas.
 * No decide nada por sí sola (el Content-Type lo elige el cliente); la
 * verificación real es la de magic bytes en `UploadsService.uploadImage`.
 */
function imageFileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
): void {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(
      new BadRequestException(
        `Solo se permiten imágenes (JPG, PNG, WebP, GIF): ${file.mimetype}`,
      ),
      false,
    );
    return;
  }
  cb(null, true);
}

@Controller("uploads")
export class ImageUploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post("image")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
      fileFilter: imageFileFilter,
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.uploadsService.uploadImage(file);
  }
}
