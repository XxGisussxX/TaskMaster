import { CheckCircle2, Timer } from "lucide-react";
import { TaskStatus } from "@taskmaster/contracts";

const STATUS_META: Record<
  TaskStatus,
  { label: string; bar: string; chip: string }
> = {
  [TaskStatus.TODO]: {
    label: "Por hacer",
    bar: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
  },
  [TaskStatus.IN_PROGRESS]: {
    label: "En curso",
    bar: "bg-primary",
    chip: "bg-primary/10 text-primary",
  },
  [TaskStatus.IN_REVIEW]: {
    label: "En revisión",
    bar: "bg-warning",
    chip: "bg-warning/10 text-warning",
  },
  [TaskStatus.DONE]: {
    label: "Completada",
    bar: "bg-success",
    chip: "bg-success/10 text-success",
  },
  [TaskStatus.ARCHIVED]: {
    label: "Archivada",
    bar: "bg-secondary",
    chip: "bg-secondary/40 text-secondary-foreground",
  },
};

export function TodaySummaryCard({
  completedToday,
  avgCompletionDays,
  statusDistribution,
}: {
  completedToday: number;
  avgCompletionDays: number;
  statusDistribution: Record<TaskStatus, number>;
}) {
  const total = Object.values(statusDistribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/40 p-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Completadas hoy
          </span>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {completedToday}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Timer className="h-3.5 w-3.5 text-warning" />
            Tiempo promedio
          </span>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {avgCompletionDays.toLocaleString("es")}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              días
            </span>
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Estado de las tareas
          </p>
          <span className="text-[11px] text-muted-foreground">{total}</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {(Object.keys(STATUS_META) as TaskStatus[]).map((status) => {
            const meta = STATUS_META[status];
            const count = statusDistribution[status] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={status} title={`${meta.label}: ${count}`}>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${meta.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_META) as TaskStatus[]).map((status) => {
            const meta = STATUS_META[status];
            const count = statusDistribution[status] ?? 0;
            return (
              <li
                key={status}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${meta.chip}`}
              >
                {meta.label}
                <span className="tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
