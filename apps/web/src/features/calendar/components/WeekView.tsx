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

function DraggableTaskChip({
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
        "truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
        "bg-primary/10 text-primary hover:bg-primary/20",
        readOnly ? "cursor-pointer" : "cursor-grab",
        isDragging && "opacity-50",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onEdit(task);
      }}
      title={task.title}
    >
      {task.title}
    </div>
  );
}

function DroppableDay({
  dateKey,
  children,
}: {
  dateKey: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[100px] rounded-md border p-1.5 transition-colors",
        isOver ? "border-primary bg-primary/5" : "border-transparent",
      )}
    >
      {children}
    </div>
  );
}

export function WeekView({
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
  const today = formatDateISO(new Date());

  const weekDays = useMemo(() => {
    const start = new Date(cursor);
    const dayOfWeek = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayOfWeek);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = formatDateISO(task.dueDate);
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

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

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d, i) => {
          const date = weekDays[i]!;
          const dateKey = formatDateISO(date);
          const dayTasks = tasksByDay.get(dateKey) ?? [];
          const isToday = dateKey === today;

          return (
            <div key={dateKey}>
              <div
                className={cn(
                  "py-2 text-center text-xs font-medium",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {d} {date.getDate()}
              </div>
              <DroppableDay dateKey={dateKey}>
                <div
                  className="cursor-pointer"
                  onClick={() => {
                    if (!readOnly) onDayClick(date);
                  }}
                >
                  {dayTasks.map((task) => (
                    <DraggableTaskChip
                      key={task.id}
                      task={task}
                      onEdit={onTaskEdit}
                      readOnly={readOnly}
                    />
                  ))}
                  {dayTasks.length === 0 && <div className="h-6" />}
                </div>
              </DroppableDay>
            </div>
          );
        })}
      </div>
    </DndContext>
  );
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
