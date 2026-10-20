import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  NoteType,
  StickyColor,
  MAX_NOTE_CONTENT_CHARS,
} from "@taskmaster/contracts";
import type { Note } from "@taskmaster/contracts";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { FileUpload } from "@/features/attachments/components/FileUpload";
import { CustomFieldForm } from "@/features/custom-fields/components/CustomFieldForm";

const formSchema = z.object({
  type: z.nativeEnum(NoteType),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  content: z.string().max(MAX_NOTE_CONTENT_CHARS).optional().or(z.literal("")),
  color: z.nativeEnum(StickyColor).optional(),
  pinned: z.boolean().optional(),
});

export type NoteFormValues = z.infer<typeof formSchema>;

export function NoteForm({
  note,
  onSubmit,
  submitting,
  disabled = false,
}: {
  note?: Note | null;
  onSubmit: (values: NoteFormValues) => void;
  submitting?: boolean;
  disabled?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: note?.type ?? NoteType.STANDARD,
      title: note?.title ?? "",
      content: note?.content ?? "",
      color: note?.color ?? StickyColor.YELLOW,
      pinned: note?.pinned ?? false,
    },
  });

  const type = watch("type");

  useEffect(() => {
    if (note) {
      reset({
        type: note.type,
        title: note.title ?? "",
        content: note.content ?? "",
        color: note.color ?? StickyColor.YELLOW,
        pinned: note.pinned,
      });
    }
  }, [note, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" {...register("type")}>
            {Object.values(NoteType).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Select id="color" {...register("color")}>
            {Object.values(StickyColor).map((c) => (
              <option key={c} value={c}>
                {COLOR_LABEL[c]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          placeholder={
            type === NoteType.STICKY ? "Pegatina…" : "Título opcional"
          }
          {...register("title")}
        />
      </div>

      <div className="space-y-2">
        <Label>Contenido</Label>
        <RichTextEditor
          value={watch("content") ?? ""}
          onChange={(val) => setValue("content", val)}
          placeholder="Escribe aquí…"
          editable={!disabled}
        />
        {errors.content && (
          <p className="text-sm text-destructive">{errors.content.message}</p>
        )}
      </div>

      {!disabled && (
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Guardando…" : note ? "Guardar cambios" : "Crear nota"}
        </Button>
      )}

      {note && (
        <>
          <hr className="my-4 border-border" />
          <h4 className="mb-3 text-sm font-medium">Archivos adjuntos</h4>
          <FileUpload noteId={note.id} readOnly={disabled} />

          <hr className="my-4 border-border" />
          <h4 className="mb-3 text-sm font-medium">Campos personalizados</h4>
          <CustomFieldForm
            entityType="note"
            entityId={note.id}
            readOnly={disabled}
          />
        </>
      )}
    </form>
  );
}

const TYPE_LABEL: Record<NoteType, string> = {
  [NoteType.STANDARD]: "Estándar",
  [NoteType.CHECKLIST]: "Lista",
  [NoteType.IDEA]: "Idea",
  [NoteType.MEETING]: "Reunión",
  [NoteType.STICKY]: "Pegatina",
};

const COLOR_LABEL: Record<StickyColor, string> = {
  [StickyColor.YELLOW]: "Amarillo",
  [StickyColor.PINK]: "Rosa",
  [StickyColor.BLUE]: "Azul",
  [StickyColor.GREEN]: "Verde",
};
