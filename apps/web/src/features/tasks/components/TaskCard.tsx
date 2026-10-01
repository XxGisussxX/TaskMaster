import { useState } from "react";
import type { Task } from "@taskmaster/contracts";
import {
  CheckCircle2,
  CalendarDays,
  Pencil,
  Trash2,
  Circle,
  RotateCcw,
  Check,
  ListChecks,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { RichText } from "@/components/ui/rich-text";
import { PriorityBadge } from "./PriorityBadge";
import { TimerButton } from "@/features/time-entries/components/TimerButton";
import { formatDate, formatRelativeTime } from "@/lib/date";

export function TaskCard({
  task,
  onToggleComplete,
  onEdit,
  onDelete,
  selected,
  onSelect,
  disabled = false,
}: {
  task: Task;
  onToggleComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
  disabled?: boolean;
}) {
  const done = task.status === "DONE";
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Card className="group flex flex-col gap-2 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="relative flex items-center gap-2">
          {!disabled && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Opciones de tarea"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
            >
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : selected ? (
                <Circle className="h-5 w-5 fill-current text-primary" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </button>
          )}
          {disabled && (
            <span className="mt-0.5 text-muted-foreground">
              {done ? (
                <CheckCircle2 className="h-5 w-5 text-success" />
              ) : (
                <Circle className="h-5 w-5" />
              )}
            </span>
          )}
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-md border border-border bg-card py-1 shadow-md">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    onToggleComplete(task);
                    setMenuOpen(false);
                  }}
                >
                  {done ? (
                    <RotateCcw className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {done ? "Reabrir tarea" : "Completar tarea"}
                </button>
                {onSelect && (
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      onSelect(task.id);
                      setMenuOpen(false);
                    }}
                  >
                    <ListChecks className="h-4 w-4" />
                    {selected ? "Quitar selección" : "Seleccionar"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
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
          {disabled ? null : (
            <>
              <TimerButton taskId={task.id} taskTitle={task.title} />
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
            </>
          )}
        </div>
      </div>

      {task.description && (
        <RichText
          html={task.description}
          className="line-clamp-2 text-xs text-muted-foreground"
        />
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
