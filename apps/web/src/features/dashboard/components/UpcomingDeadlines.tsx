import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Flag } from "lucide-react";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { StatusBadge } from "@/features/tasks/components/StatusBadge";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date";
import { upcomingDeadlines } from "../lib/dashboardStats";

const PRIORITY_META: Record<Priority, { label: string; className: string }> = {
  [Priority.URGENT]: { label: "Urgente", className: "text-destructive" },
  [Priority.HIGH]: { label: "Alta", className: "text-warning" },
  [Priority.MEDIUM]: { label: "Media", className: "text-primary" },
  [Priority.LOW]: { label: "Baja", className: "text-muted-foreground" },
};

function dueLabel(dueDate: string, now = new Date()): string {
  const due = new Date(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((dateOnly.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return formatDate(dueDate, { day: "numeric", month: "short" });
}

export function UpcomingDeadlines() {
  const navigate = useNavigate();
  const { data, isLoading } = useTasks({ pageSize: 200 });
  const deadlines = useMemo(() => upcomingDeadlines(data?.items ?? []), [data]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando tareas...</p>;
  }

  if (deadlines.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin fechas límite próximas. Las tareas abiertas con fecha límite
        aparecerán aquí.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {deadlines.map((task) => {
        const priority = PRIORITY_META[task.priority];
        return (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => navigate("/tasks")}
              className="flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Flag className={cn("h-4 w-4 shrink-0", priority.className)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {task.title}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <CalendarClock className="h-3 w-3" />
                  {task.dueDate ? dueLabel(task.dueDate) : "—"}
                  {task.status !== TaskStatus.TODO && (
                    <>
                      <span aria-hidden>·</span>
                      <StatusBadge status={task.status} />
                    </>
                  )}
                </span>
              </span>
              {task.assignees.length > 0 && (
                <span className="flex -space-x-1.5">
                  {task.assignees.slice(0, 3).map((assignee) => (
                    <Avatar
                      key={assignee.id}
                      name={assignee.name}
                      src={assignee.avatarUrl}
                      className="h-6 w-6 text-[9px] ring-2 ring-card"
                    />
                  ))}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
