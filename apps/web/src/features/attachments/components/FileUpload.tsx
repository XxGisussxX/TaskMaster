import { useCallback, useRef, useState } from "react";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "../hooks/useAttachments";
import type { Attachment } from "@taskmaster/contracts";

interface FileUploadProps {
  taskId?: string;
  noteId?: string;
  className?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({ taskId, noteId, className }: FileUploadProps) {
  const context = { taskId, noteId };
  const { data: attachments = [] } = useAttachments(context);
  const uploadMutation = useUploadAttachment(context);
  const deleteMutation = useDeleteAttachment();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          continue;
        }
        if (!ACCEPTED.includes(file.type)) {
          continue;
        }
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        )}
      >
        <Upload className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-xs text-muted-foreground/70">
          Máx. 10 MB · Imágenes, PDF, documentos, CSV, JSON
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Subiendo archivo...
        </div>
      )}

      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((a: Attachment) => (
            <AttachmentItem
              key={a.id}
              attachment={a}
              onDelete={() => deleteMutation.mutate(a.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentItem({
  attachment,
  onDelete,
}: {
  attachment: Attachment;
  onDelete: () => void;
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  return (
    <li className="group flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.fileName}
          className="size-8 rounded object-cover"
        />
      ) : (
        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate font-medium hover:underline"
      >
        {attachment.fileName}
      </a>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatSize(attachment.fileSize)}
      </span>
      <a
        href={attachment.url}
        download={attachment.fileName}
        className="shrink-0 text-xs text-primary hover:underline"
      >
        Descargar
      </a>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
        onClick={onDelete}
      >
        <X className="size-3" />
      </Button>
    </li>
  );
}
