import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  Calendar,
} from "lucide-react";
import type { Task } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useCurrentWorkspaceId,
} from "@/features/tasks/hooks/useTasks";
import { formatDateISO } from "@/lib/date";
import { ReminderList } from "@/features/reminders/components/ReminderList";
import { TaskModal } from "@/features/tasks/components/TaskModal";
import type { TaskFormValues } from "@/features/tasks/components/TaskForm";
import { MonthView } from "../components/MonthView";
import { WeekView } from "../components/WeekView";
import { DayView } from "../components/DayView";
import { http } from "@/services/http";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import { useUiStore } from "@/store/ui.store";

type ViewMode = "month" | "week" | "day";

export function CalendarPage() {
  const today = new Date();
  const workspaceId = useCurrentWorkspaceId();
  const [cursor, setCursor] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [prefilledDate, setPrefilledDate] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useTasks({ pageSize: 500 });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const { canWrite } = useCurrentMembership();
  const taskModalRequest = useUiStore((s) => s.taskModalRequest);
  const consumeTaskModalRequest = useUiStore((s) => s.consumeTaskModalRequest);

  useEffect(() => {
    if (!taskModalRequest) return;
    if (taskModalRequest.mode === "create") {
      if (canWrite) {
        setEditing(null);
        setPrefilledDate(null);
        setModalOpen(true);
      }
    } else {
      setEditing(taskModalRequest.task);
      setPrefilledDate(null);
      setModalOpen(true);
    }
    consumeTaskModalRequest();
  }, [taskModalRequest, canWrite, consumeTaskModalRequest]);

  const tasks = useMemo(() => data?.items ?? [], [data?.items]);

  const handlePrev = () => {
    if (viewMode === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    } else if (viewMode === "week") {
      const d = new Date(cursor);
      d.setDate(d.getDate() - 7);
      setCursor(d);
    } else {
      const d = new Date(cursor);
      d.setDate(d.getDate() - 1);
      setCursor(d);
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    } else if (viewMode === "week") {
      const d = new Date(cursor);
      d.setDate(d.getDate() + 7);
      setCursor(d);
    } else {
      const d = new Date(cursor);
      d.setDate(d.getDate() + 1);
      setCursor(d);
    }
  };

  const handleToday = () => {
    if (viewMode === "month") {
      setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    } else {
      setCursor(new Date());
    }
  };

  const handleDayClick = (date: Date) => {
    setEditing(null);
    setPrefilledDate(formatDateISO(date));
    setModalOpen(true);
  };

  const handleTaskEdit = (task: Task) => {
    setEditing(task);
    setPrefilledDate(null);
    setModalOpen(true);
  };

  const handleDateDrop = (taskId: string, newDate: string) => {
    if (!canWrite) return;
    updateTask.mutate({
      id: taskId,
      input: { dueDate: newDate },
    });
  };

  const handleSubmit = async (values: TaskFormValues) => {
    const { subtasks: newSubtasks, ...taskInput } = values;
    if (editing) {
      await updateTask.mutateAsync({
        id: editing.id,
        input: {
          ...taskInput,
          dueDate: taskInput.dueDate || null,
          startDate: taskInput.startDate || null,
          channelId: taskInput.channelId || null,
        },
      });
    } else {
      const created = await createTask.mutateAsync({
        ...taskInput,
        dueDate: prefilledDate || taskInput.dueDate || null,
        startDate: taskInput.startDate || null,
        channelId: taskInput.channelId || null,
      });
      for (const st of newSubtasks) {
        await http.post(
          `/workspaces/${workspaceId}/tasks/${created.id}/subtasks`,
          { title: st.title },
        );
      }
    }
  };

  const headerLabel = getHeaderLabel(cursor, viewMode);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        description={headerLabel}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Anterior"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Siguiente"
              onClick={handleNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <div className="ml-2 flex rounded-md border">
              {VIEW_OPTIONS.map((v) => (
                <Button
                  key={v.value}
                  variant={viewMode === v.value ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 rounded-none px-2"
                  onClick={() => setViewMode(v.value)}
                >
                  <v.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{v.label}</span>
                </Button>
              ))}
            </div>
          </div>
        }
      />

      {!isLoading && !isError && data && data.total > tasks.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando {tasks.length} de {data.total} tareas en el calendario.
        </p>
      )}

      {isLoading ? (
        <PageLoader />
      ) : isError ? (
        <ErrorState
          title="No se pudo cargar el calendario"
          onRetry={() => void refetch()}
        />
      ) : (
        <Card className="p-4">
          {viewMode === "month" && (
            <MonthView
              tasks={tasks}
              cursor={cursor}
              onDayClick={handleDayClick}
              onTaskEdit={handleTaskEdit}
              onDateDrop={handleDateDrop}
              readOnly={!canWrite}
            />
          )}
          {viewMode === "week" && (
            <WeekView
              tasks={tasks}
              cursor={cursor}
              onDayClick={handleDayClick}
              onTaskEdit={handleTaskEdit}
              onDateDrop={handleDateDrop}
              readOnly={!canWrite}
            />
          )}
          {viewMode === "day" && (
            <DayView
              tasks={tasks}
              cursor={cursor}
              onDayClick={handleDayClick}
              onTaskEdit={handleTaskEdit}
              onDateDrop={handleDateDrop}
              readOnly={!canWrite}
            />
          )}
        </Card>
      )}

      {!isLoading && !isError && tasks.length === 0 && (
        <EmptyState
          title="Sin tareas con fecha"
          description="Asigna fechas a tus tareas para verlas aquí"
        />
      )}

      <Card className="p-4">
        <ReminderList />
      </Card>

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editing}
        onSubmit={handleSubmit}
        submitting={createTask.isPending || updateTask.isPending}
      />
    </div>
  );
}

function getHeaderLabel(cursor: Date, viewMode: ViewMode): string {
  if (viewMode === "month") {
    return cursor.toLocaleDateString("es", {
      month: "long",
      year: "numeric",
    });
  }
  if (viewMode === "week") {
    const start = new Date(cursor);
    const dayOfWeek = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - dayOfWeek);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startLabel = start.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
    });
    const endLabel = end.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${startLabel} – ${endLabel}`;
  }
  return cursor.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const VIEW_OPTIONS = [
  { value: "month" as const, label: "Mes", icon: Calendar },
  { value: "week" as const, label: "Semana", icon: CalendarRange },
  { value: "day" as const, label: "Día", icon: CalendarDays },
];
