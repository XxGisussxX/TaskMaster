import { useEffect, useRef } from "react";
import Gantt from "frappe-gantt";
import type { Task } from "@taskmaster/contracts";
import { useUpdateTask } from "../hooks/useTasks";

interface GanttViewProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  readOnly?: boolean;
}

export function GanttView({ tasks, onEdit, readOnly = false }: GanttViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<InstanceType<typeof Gantt> | null>(null);
  const updateTask = useUpdateTask();

  const ganttTasks: Gantt.Task[] = tasks
    .filter((t) => t.dueDate)
    .map((t) => {
      const start = t.startDate ? new Date(t.startDate) : new Date(t.dueDate!);
      const end = new Date(t.dueDate!);
      if (start > end) start.setTime(end.getTime());
      return {
        id: t.id,
        name: t.title,
        start: formatDate(start),
        end: formatDate(end),
        progress: t.status === "DONE" ? 100 : 0,
        dependencies: "",
        custom_class: `gantt-${t.status.toLowerCase()}`,
      };
    });

  useEffect(() => {
    if (!containerRef.current || ganttTasks.length === 0) return;
    const el = containerRef.current;

    if (ganttRef.current) {
      ganttRef.current.refresh(ganttTasks);
      return;
    }

    ganttRef.current = new Gantt(el, ganttTasks, {
      view_mode: "Day",
      date_format: "YYYY-MM-DD",
      readonly: readOnly,
      on_click: (task: Gantt.Task) => {
        if (readOnly || !task.id) return;
        const found = tasks.find((t) => t.id === task.id);
        if (found) onEdit(found);
      },
      on_date_change: (task: Gantt.Task, start: Date, end: Date) => {
        if (readOnly || !task.id) return;
        updateTask.mutate({
          id: task.id,
          input: {
            startDate: start.toISOString(),
            dueDate: end.toISOString(),
          },
        });
      },
    } as Gantt.Options);

    return () => {
      if (ganttRef.current) {
        ganttRef.current = null;
        el.innerHTML = "";
      }
    };
  }, [ganttTasks, tasks, onEdit, updateTask, readOnly]);

  if (ganttTasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        <p className="text-sm">
          No hay tareas con fecha de vencimiento para mostrar en la vista Gantt.
        </p>
        <p className="text-xs">
          Asigna fechas de vencimiento a las tareas para verlas aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-[#94a3b8]" /> Por
          hacer
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-[#3b82f6]" /> En
          curso
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-[#f59e0b]" /> En
          revisión
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block size-2 rounded-full bg-[#22c55e]" />{" "}
          Completada
        </span>
      </div>
      <div className="gantt-container overflow-x-auto" ref={containerRef} />
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
