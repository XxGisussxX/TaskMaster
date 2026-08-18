import { useState } from "react";
import type { Task } from "@taskmaster/contracts";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateTaskDependency,
  useTaskDependencies,
} from "../hooks/useTaskDependencies";

interface AddDependencyButtonProps {
  taskId: string;
  tasks: Task[];
  direction: "from" | "to";
}

export function AddDependencyButton({
  taskId,
  tasks,
  direction,
}: AddDependencyButtonProps) {
  const [open, setOpen] = useState(false);
  const { data: deps } = useTaskDependencies(taskId);
  const createMut = useCreateTaskDependency();

  const label = direction === "from" ? "Bloquea a..." : "Bloqueado por...";

  const linkedIds = new Set<string>();
  if (deps) {
    for (const d of deps) {
      linkedIds.add(d.fromTaskId);
      linkedIds.add(d.toTaskId);
    }
  }
  linkedIds.delete(taskId);

  const available = tasks.filter(
    (t) => t.id !== taskId && !linkedIds.has(t.id),
  );

  function handleSelect(targetId: string) {
    const input =
      direction === "from"
        ? { fromTaskId: taskId, toTaskId: targetId }
        : { fromTaskId: targetId, toTaskId: taskId };

    createMut.mutate(input);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        {label}
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-60 rounded-md border bg-popover p-1 shadow-md">
          {available.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              No hay tareas disponibles
            </p>
          ) : (
            available.map((t) => (
              <button
                key={t.id}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => handleSelect(t.id)}
              >
                <span className="flex-1 truncate text-left">{t.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
