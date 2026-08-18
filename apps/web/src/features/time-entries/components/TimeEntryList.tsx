import { Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTimeEntries, useDeleteTimeEntry } from "../hooks/useTimeEntries";
import { formatDate } from "@/lib/date";
import type { TimeEntry } from "@taskmaster/contracts";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimeEntryRow({
  entry,
  onDelete,
}: {
  entry: TimeEntry;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {formatDuration(entry.duration ?? 0)}
          </span>
          {entry.user && (
            <span className="text-xs text-muted-foreground">
              · {entry.user.name}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatDate(entry.startedAt)}
          {entry.description ? ` · ${entry.description}` : ""}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => onDelete(entry.id)}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

interface TimeEntryListProps {
  taskId: string;
}

export function TimeEntryList({ taskId }: TimeEntryListProps) {
  const { data: entries = [], isLoading } = useTimeEntries({ taskId });
  const deleteEntry = useDeleteTimeEntry();

  function handleDelete(id: string) {
    if (window.confirm("¿Eliminar esta entrada de tiempo?")) {
      deleteEntry.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Registro de tiempo ({entries.length})
      </h3>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin registros de tiempo.
        </p>
      )}

      <div className="space-y-2">
        {entries.map((entry) => (
          <TimeEntryRow key={entry.id} entry={entry} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  );
}
