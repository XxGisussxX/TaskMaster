import type { Task } from "@taskmaster/contracts";
import {
  CheckCircle2,
  CalendarDays,
  Pencil,
  Trash2,
  Circle,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PriorityBadge } from "./PriorityBadge";
import { formatDate, formatRelativeTime } from "@/lib/date";

export function TaskCard({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}) {
  const done = task.status === "DONE";

  return (
    <Card className="group flex flex-col gap-2 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => onToggleComplete(task)}
          aria-label={done ? "Reabrir tarea" : "Completar tarea"}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-success"
        >
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-success" />
          ) : (
            <Circle className="h-5 w-5" />
          )}
        </button>
        <p
          className={
            done
              ? "flex-1 text-sm text-muted-foreground line-through"
              : "flex-1 text-sm font-medium"
          }
        >
          {task.title}
        </p>
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <PriorityBadge priority={task.priority} />
        {task.isRecurring && (
          <span
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
            title={`Recurrente: cada ${task.recurrence?.interval ?? 1} ${task.recurrence?.frequency?.toLowerCase() ?? ""}`}
          >
            <RotateCcw className="h-3 w-3" />
          </span>
        )}
        {task.dueDate && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDate(task.dueDate)}
          </span>
        )}
        {task.tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded bg-secondary px-1.5 py-0.5 text-xs"
            style={tag.color ? { color: tag.color } : undefined}
          >
            {tag.name}
          </span>
        ))}
      </div>

      {task.assignees.length > 0 && (
        <div className="flex -space-x-2 pt-1">
          {task.assignees.map((a) => (
            <Avatar
              key={a.id}
              name={a.name}
              src={a.avatarUrl}
              className="h-6 w-6 text-[10px] ring-2 ring-card"
            />
          ))}
        </div>
      )}

      <span className="text-xs text-muted-foreground">
        {formatRelativeTime(task.createdAt)}
      </span>
    </Card>
  );
}
