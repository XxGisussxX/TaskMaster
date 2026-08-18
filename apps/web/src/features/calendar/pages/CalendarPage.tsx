import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useTasks } from "@/features/tasks/hooks/useTasks";
import { formatDateISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import { ReminderList } from "@/features/reminders/components/ReminderList";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const { data, isLoading } = useTasks({ pageSize: 500 });

  const tasksByDay = useMemo(() => {
    const map = new Map<string, { id: string; title: string }[]>();
    for (const task of data?.items ?? []) {
      if (!task.dueDate) continue;
      const key = formatDateISO(task.dueDate);
      const list = map.get(key) ?? [];
      list.push({ id: task.id, title: task.title });
      map.set(key, list);
    }
    return map;
  }, [data?.items]);

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

  const monthLabel = cursor.toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        description={monthLabel}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Mes anterior"
              onClick={() => prevMonth(cursor, setCursor)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
              }
            >
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Mes siguiente"
              onClick={() => nextMonth(cursor, setCursor)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <PageLoader />
      ) : (
        <Card className="p-4">
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
              const isToday = formatDateISO(date) === formatDateISO(today);
              return (
                <div
                  key={key}
                  className={cn(
                    "min-h-[88px] rounded-md border p-1.5",
                    isToday
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/50",
                  )}
                >
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
                    {dayTasks.slice(0, 2).map((t) => (
                      <div
                        key={t.id}
                        className="truncate rounded bg-primary/10 px-1 py-0.5 text-[10px] text-primary"
                        title={t.title}
                      >
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayTasks.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {!isLoading && tasksByDay.size === 0 && (
        <EmptyState
          title="Sin tareas con fecha"
          description="Asigna fechas a tus tareas para verlas aquí"
        />
      )}

      <Card className="p-4">
        <ReminderList />
      </Card>
    </div>
  );
}

function prevMonth(cursor: Date, set: (d: Date) => void) {
  set(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
}
function nextMonth(cursor: Date, set: (d: Date) => void) {
  set(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
}
