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
}: {
  task: Task;
  onEdit: (task: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      data: { task },
    });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={style}
      className={cn(
        "cursor-grab truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary",
        "hover:bg-primary/20",
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

function DroppableCell({
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
        "min-h-[88px] rounded-md border p-1.5",
        isOver
          ? "border-primary bg-primary/5"
          : "border-transparent hover:bg-muted/50",
      )}
    >
      {children}
    </div>
  );
}

export function MonthView({
  tasks,
  cursor,
  onDayClick,
  onTaskEdit,
  onDateDrop,
}: {
  tasks: Task[];
  cursor: Date;
  onDayClick: (date: Date) => void;
  onTaskEdit: (task: Task) => void;
  onDateDrop: (taskId: string, newDate: string) => void;
}) {
  const today = formatDateISO(new Date());

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

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const result: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    return result;
  }, [cursor]);

  const handleDragEnd = (event: DragEndEvent) => {
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
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const key = formatDateISO(date);
          const dayTasks = tasksByDay.get(key) ?? [];
          const isToday = key === today;

          return (
            <DroppableCell key={key} dateKey={key}>
              <div className="cursor-pointer" onClick={() => onDayClick(date)}>
                <span
                  className={cn(
                    "text-xs",
                    isToday
                      ? "font-bold text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  {date.getDate()}
                </span>
                <div className="mt-1 space-y-1">
                  {dayTasks.slice(0, 2).map((task) => (
                    <DraggableTaskChip
                      key={task.id}
                      task={task}
                      onEdit={onTaskEdit}
                    />
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayTasks.length - 2} más
                    </div>
                  )}
                </div>
              </div>
            </DroppableCell>
          );
        })}
      </div>
    </DndContext>
  );
}

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
