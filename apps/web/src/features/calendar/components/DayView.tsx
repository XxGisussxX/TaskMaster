import { useMemo } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Task } from "@taskmaster/contracts";
import { cn } from "@/lib/utils";
import { formatDateISO } from "@/lib/date";
import { PriorityBadge } from "@/features/tasks/components/PriorityBadge";
import { StatusBadge } from "@/features/tasks/components/StatusBadge";

function DraggableTaskRow({
  task,
  onEdit,
  readOnly,
}: {
  task: Task;
  onEdit: (task: Task) => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
      disabled: readOnly,
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...(readOnly ? {} : listeners)}
      {...(readOnly ? {} : attributes)}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-muted/50",
        readOnly ? "cursor-pointer" : "cursor-grab",
        isDragging && "opacity-50",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(task);
      }}
    >
      <PriorityBadge priority={task.priority} />
      <span className="flex-1 text-sm font-medium">{task.title}</span>
      <StatusBadge status={task.status} />
      {task.tags.length > 0 && (
        <div className="flex gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px]"
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
      {task.assignees.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {task.assignees.length} asignado{task.assignees.length > 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

export function DayView({
  tasks,
  cursor,
  onDayClick,
  onTaskEdit,
  onDateDrop,
  readOnly = false,
}: {
  tasks: Task[];
  cursor: Date;
  onDayClick: (date: Date) => void;
  onTaskEdit: (task: Task) => void;
  onDateDrop: (taskId: string, newDate: string) => void;
  readOnly?: boolean;
}) {
  const dateKey = formatDateISO(cursor);
  const today = formatDateISO(new Date());
  const isToday = dateKey === today;

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate && formatDateISO(t.dueDate) === dateKey)
        .sort((a, b) => {
          const priorityOrder = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
          return (
            (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)
          );
        }),
    [tasks, dateKey],
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newDate = over.id as string;
    if (taskId !== newDate) {
      onDateDrop(taskId, newDate);
    }
  };

  const dateLabel = cursor.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div
        ref={setNodeRef}
        className={cn(
          "rounded-lg border p-4",
          isOver ? "border-primary bg-primary/5" : "",
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3
            className={cn(
              "text-lg font-semibold capitalize",
              isToday && "text-primary",
            )}
          >
            {dateLabel}
            {isToday && (
              <span className="ml-2 text-sm font-normal text-primary">
                (Hoy)
              </span>
            )}
          </h3>
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              if (!readOnly) onDayClick(cursor);
            }}
          >
            + Nueva tarea
          </button>
        </div>

        {dayTasks.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Sin tareas para este día
          </div>
        ) : (
          <div className="space-y-2">
            {dayTasks.map((task) => (
              <DraggableTaskRow
                key={task.id}
                task={task}
                onEdit={onTaskEdit}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>
    </DndContext>
  );
}
