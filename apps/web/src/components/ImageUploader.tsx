import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { uploadImageFile } from "@/services/imageUpload";
import {
  ACCEPTED_IMAGE_TYPES,
  validateImageFile,
} from "./uploads/validateImageFile";

export type UploadImageFn = (
  file: File,
  onProgress: (percent: number) => void,
) => Promise<string>;

export interface ImageUploaderProps {
  /** URL actual (o `null` si todavía no hay imagen). */
  value?: string | null;
  onChange: (url: string) => void;
  /** Sobrescribible para tests y para otros backends de subida. */
  uploadImage?: UploadImageFn;
  disabled?: boolean;
}

/**
 * Subida de imágenes reutilizable: selector de archivo, drag & drop y pegado
 * con Ctrl+V, con preview, validación, progreso y un campo alternativo para
 * pegar una URL directamente.
 */
export function ImageUploader({
  value,
  onChange,
  uploadImage = uploadImageFile,
  disabled,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (uploading) return;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(value ?? null);
  }, [value, uploading]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      if (typeof URL.createObjectURL === "function") {
        objectUrlRef.current = URL.createObjectURL(file);
        setPreview(objectUrlRef.current);
      }

      setUploading(true);
      setProgress(0);
      try {
        const url = await uploadImage(file, setProgress);
        onChange(url);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "No se pudo subir la imagen",
        );
      } finally {
        setUploading(false);
      }
    },
    [onChange, uploadImage],
  );

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (disabled) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void handleFile(file);
          }
          break;
        }
      }
    }
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handleFile, disabled]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleUrlChange = (url: string) => {
    setError(null);
    onChange(url);
  };

  const canInteract = !disabled && !uploading;

  return (
    <div className="space-y-3" data-testid="image-uploader">
      {error && (
        <p
          role="alert"
          data-testid="image-upload-error"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {preview ? (
        <div className="relative overflow-hidden rounded-lg">
          <img
            src={preview}
            alt="Vista previa"
            data-testid="image-preview"
            className="h-40 w-full object-cover"
          />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">
              Subiendo… {progress}%
            </div>
          ) : (
            <button
              type="button"
              disabled={!canInteract}
              onClick={() => handleUrlChange("")}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
              aria-label="Quitar imagen"
              data-testid="image-remove"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : null}

      <div
        data-testid="image-dropzone"
        onDragOver={(event) => {
          event.preventDefault();
          if (canInteract) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => canInteract && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-4 py-6 text-center transition-colors",
          dragging && "border-primary bg-primary/10",
          !canInteract && "cursor-not-allowed opacity-60",
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastrá una imagen acá, pegala con Ctrl+V o
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canInteract}
          onClick={(event) => {
            event.stopPropagation();
            inputRef.current?.click();
          }}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              Subiendo… {progress}%
            </>
          ) : (
            <>
              <ImagePlus className="mr-1.5 h-4 w-4" />
              Seleccionar archivo
            </>
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          className="hidden"
          data-testid="image-upload-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
          disabled={disabled}
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="image-url-input"
          className="text-xs text-muted-foreground"
        >
          O pega una URL:
        </label>
        <Input
          id="image-url-input"
          type="url"
          value={value ?? ""}
          onChange={(event) => handleUrlChange(event.target.value)}
          placeholder="https://..."
          disabled={disabled}
          data-testid="image-url-input"
        />
      </div>
    </div>
  );
}
