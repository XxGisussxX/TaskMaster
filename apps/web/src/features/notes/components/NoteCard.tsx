import type { Note, CustomFieldValue } from "@taskmaster/contracts";
import { NoteType } from "@taskmaster/contracts";
import { Pin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CustomFieldChips } from "@/features/custom-fields/components/CustomFieldChips";
import { getChecklistProgress, getContentSize } from "@taskmaster/domain";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/date";

const TYPE_ICON: Record<NoteType, string> = {
  [NoteType.STANDARD]: "📝",
  [NoteType.CHECKLIST]: "☑️",
  [NoteType.IDEA]: "💡",
  [NoteType.MEETING]: "📅",
  [NoteType.STICKY]: "📌",
};

const SIZE_CLASSES: Record<string, string> = {
  xs: "min-h-[96px]",
  small: "min-h-[128px]",
  "sm-plus": "min-h-[160px]",
  medium: "min-h-[192px]",
  "md-plus": "min-h-[224px]",
  large: "min-h-[256px]",
};

const COLOR_BG: Record<string, string> = {
  YELLOW: "bg-amber-100 dark:bg-amber-950/40",
  PINK: "bg-pink-100 dark:bg-pink-950/40",
  BLUE: "bg-sky-100 dark:bg-sky-950/40",
  GREEN: "bg-emerald-100 dark:bg-emerald-950/40",
};

export function NoteCard({
  note,
  customValues,
  onEdit,
  onDelete,
  onTogglePin,
  disabled = false,
}: {
  note: Note;
  customValues?: CustomFieldValue[];
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  disabled?: boolean;
}) {
  const size = getContentSize({
    type: note.type,
    content: note.content,
    items: note.items,
  });
  const checklist =
    note.type === NoteType.CHECKLIST ? getChecklistProgress(note.items) : null;

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-2 rounded-lg border p-4 shadow-sm transition-shadow hover:shadow-md",
        COLOR_BG[note.color ?? "YELLOW"],
        SIZE_CLASSES[size],
      )}
    >
      {note.pinned && (
        <span
          className="absolute right-3 top-3 text-warning"
          aria-label="Fijada"
        >
          <Pin className="h-4 w-4" />
        </span>
      )}

      <div className="flex items-center gap-2 pr-6">
        <span aria-hidden>{TYPE_ICON[note.type]}</span>
        <h3 className="truncate text-sm font-semibold">
          {note.title ?? "Sin título"}
        </h3>
      </div>

      <p className="line-clamp-4 text-sm whitespace-pre-wrap text-foreground/80">
        {note.content}
      </p>

      {checklist && checklist.total > 0 && (
        <div className="mt-auto space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {checklist.completed}/{checklist.total}
            </span>
            <span>{checklist.percentage}%</span>
          </div>
          <Progress value={checklist.percentage} />
        </div>
      )}

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((t) => (
            <span
              key={t.id}
              className="rounded bg-background/60 px-1.5 py-0.5 text-xs"
            >
              #{t.name}
            </span>
          ))}
        </div>
      )}

      <CustomFieldChips values={customValues} max={3} />

      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(note.updatedAt)}
        </span>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {disabled ? null : (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Fijar"
                onClick={() => onTogglePin(note)}
              >
                <Pin className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Editar"
                onClick={() => onEdit(note)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Eliminar"
                onClick={() => onDelete(note)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
