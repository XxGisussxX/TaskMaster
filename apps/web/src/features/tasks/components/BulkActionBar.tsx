import { useState } from "react";
import { Trash2, X, ChevronDown } from "lucide-react";
import type { Priority, TaskStatus } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { useSelectionStore } from "@/store/selection.store";
import {
  useBulkUpdateStatus,
  useBulkUpdatePriority,
  useBulkDeleteTasks,
} from "../hooks/useTasks";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "Por hacer" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "IN_REVIEW", label: "En revisión" },
  { value: "DONE", label: "Completada" },
  { value: "ARCHIVED", label: "Archivada" },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export function BulkActionBar() {
  const { selectedIds, clear } = useSelectionStore();
  const count = selectedIds.size;
  const bulkStatus = useBulkUpdateStatus();
  const bulkPriority = useBulkUpdatePriority();
  const bulkDelete = useBulkDeleteTasks();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  if (count === 0) return null;

  const ids = Array.from(selectedIds);

  const handleStatusChange = (status: TaskStatus) => {
    bulkStatus.mutate({ ids, status });
    clear();
    setShowStatusMenu(false);
  };

  const handlePriorityChange = (priority: Priority) => {
    bulkPriority.mutate({ ids, priority });
    clear();
    setShowPriorityMenu(false);
  };

  const handleDelete = () => {
    if (!window.confirm(`¿Eliminar ${count} tarea${count > 1 ? "s" : ""}?`))
      return;
    bulkDelete.mutate(ids);
    clear();
  };

  const isPending =
    bulkStatus.isPending || bulkPriority.isPending || bulkDelete.isPending;

  return (
    <div className="sticky top-0 z-10 flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <span className="text-sm font-medium">
        {count} tarea{count > 1 ? "s" : ""} seleccionada{count > 1 ? "s" : ""}
      </span>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setShowStatusMenu(!showStatusMenu);
              setShowPriorityMenu(false);
            }}
          >
            Cambiar estado
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showStatusMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border bg-card shadow-md">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => handleStatusChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setShowPriorityMenu(!showPriorityMenu);
              setShowStatusMenu(false);
            }}
          >
            Cambiar prioridad
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showPriorityMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border bg-card shadow-md">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => handlePriorityChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={handleDelete}
        >
          <Trash2 className="h-3 w-3" />
          Eliminar
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="ml-auto"
        onClick={clear}
        disabled={isPending}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
