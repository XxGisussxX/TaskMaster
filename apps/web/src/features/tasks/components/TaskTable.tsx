import type { Task } from "@taskmaster/contracts";
import { Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";
import { CustomFieldChips } from "@/features/custom-fields/components/CustomFieldChips";
import { useCustomFieldValuesMany } from "@/features/custom-fields/hooks/useCustomFields";
import { formatDate } from "@/lib/date";
import { cn } from "@/lib/utils";

export function TaskTable({
  tasks,
  onToggleComplete,
  onEdit,
  onDelete,
  selectedIds,
  onToggleSelect,
  disabled = false,
}: {
  tasks: Task[];
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  disabled?: boolean;
}) {
  const { data: valuesByTask } = useCustomFieldValuesMany(
    "task",
    tasks.map((t) => t.id),
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2 font-medium">Tarea</th>
            <th className="px-4 py-2 font-medium">Estado</th>
            <th className="px-4 py-2 font-medium">Prioridad</th>
            <th className="px-4 py-2 font-medium">Vence</th>
            <th className="px-4 py-2 font-medium">Creada</th>
            <th className="px-4 py-2 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const done = task.status === "DONE";
            return (
              <tr
                key={task.id}
                className={cn(
                  "border-b last:border-0 hover:bg-muted/40",
                  selectedIds?.has(task.id) && "bg-muted/50",
                )}
              >
                <td className="px-4 py-2">
                  <div className="flex items-start gap-2">
                    {!disabled && (
                      <button
                        onClick={() => {
                          onToggleComplete(task);
                          onToggleSelect?.(task.id);
                        }}
                        aria-label={done ? "Reabrir tarea" : "Completar tarea"}
                        className="mt-0.5 text-muted-foreground hover:text-success"
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <div className="min-w-0 space-y-1">
                      <span
                        className={
                          done
                            ? "text-muted-foreground line-through"
                            : "font-medium"
                        }
                      >
                        {task.title}
                      </span>
                      <CustomFieldChips values={valuesByTask?.[task.id]} />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-4 py-2">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {task.dueDate ? formatDate(task.dueDate) : "—"}
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {formatDate(task.createdAt)}
                </td>
                <td className="px-4 py-2">
                  {disabled ? (
                    <div className="flex justify-end" />
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar"
                        onClick={() => onEdit(task)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar"
                        onClick={() => onDelete(task)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
