export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function isSupportedImageType(type: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Devuelve un mensaje de error, o `null` si el archivo es válido. */
export function validateImageFile(file: File): string | null {
  if (!isSupportedImageType(file.type)) {
    return "Formato no permitido. Usá JPG, PNG, WebP o GIF.";
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "La imagen supera el tamaño máximo de 5 MB.";
  }
  return null;
}
