import type { Task } from "@taskmaster/contracts";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./PriorityBadge";

const COLUMNS = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"] as const;

const COLUMN_LABEL: Record<(typeof COLUMNS)[number], string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En curso",
  IN_REVIEW: "En revisión",
  DONE: "Completada",
};

const COLUMN_ACCENT: Record<(typeof COLUMNS)[number], string> = {
  TODO: "border-t-primary",
  IN_PROGRESS: "border-t-warning",
  IN_REVIEW: "border-t-secondary",
  DONE: "border-t-success",
};

export function BoardView({
  tasks,
  onEdit,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col);
        return (
          <div
            key={col}
            className={cn(
              "rounded-lg border border-t-2 bg-muted/30 p-3",
              COLUMN_ACCENT[col],
            )}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-medium">{COLUMN_LABEL[col]}</h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                {columnTasks.length}
              </span>
            </div>

            <div className="space-y-2">
              {columnTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onEdit(task)}
                  className="w-full rounded-md border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="text-sm font-medium">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(task.dueDate).toLocaleDateString("es")}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
