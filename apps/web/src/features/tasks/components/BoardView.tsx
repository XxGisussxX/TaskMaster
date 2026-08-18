import { useState } from "react";
import type { Task, TaskStatus } from "@taskmaster/contracts";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "./PriorityBadge";
import { formatDate } from "@/lib/date";

const COLUMNS = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "ARCHIVED",
] as const;

const COLUMN_LABEL: Record<(typeof COLUMNS)[number], string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En curso",
  IN_REVIEW: "En revisión",
  DONE: "Completada",
  ARCHIVED: "Archivada",
};

const COLUMN_ACCENT: Record<(typeof COLUMNS)[number], string> = {
  TODO: "border-t-primary",
  IN_PROGRESS: "border-t-warning",
  IN_REVIEW: "border-t-secondary",
  DONE: "border-t-success",
  ARCHIVED: "border-t-muted-foreground",
};

function SortableTaskCard({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/30",
      )}
      {...attributes}
      {...listeners}
      onClick={() => onEdit(task)}
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
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
      {task.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="rounded bg-secondary px-1.5 py-0.5 text-[10px]"
              style={tag.color ? { color: tag.color } : undefined}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BoardColumn({
  status,
  tasks,
  onEdit,
}: {
  status: (typeof COLUMNS)[number];
  tasks: Task[];
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-t-2 bg-muted/30 p-3 transition-colors",
        COLUMN_ACCENT[status],
        isOver && "bg-primary/5 ring-2 ring-primary/20",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">{COLUMN_LABEL[status]}</h3>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onEdit={onEdit} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function BoardView({
  tasks,
  onEdit,
  onStatusChange,
}: {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  function handleDragStart(event: DragStartEvent) {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      onStatusChange(taskId, newStatus);
    }
  }

  return (
    <DndContext
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col);
          return (
            <BoardColumn
              key={col}
              status={col}
              tasks={columnTasks}
              onEdit={onEdit}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="rounded-md border bg-card p-3 text-left shadow-xl ring-2 ring-primary/30">
            <p className="text-sm font-medium">{activeTask.title}</p>
            <div className="mt-2">
              <PriorityBadge priority={activeTask.priority} />
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
