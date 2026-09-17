import { useEffect, useMemo, useState } from "react";
import { Plus, LayoutGrid, Rows3, Kanban, BarChart3 } from "lucide-react";
import type { Task, TaskStatus } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { PageLoader, Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { useFiltersStore } from "@/store/filters.store";
import { useSelectionStore } from "@/store/selection.store";
import { useDebounce } from "@/hooks/useDebounce";
import {
  useCreateTask,
  useDeleteTask,
  useTasks,
  useUpdateTask,
  useCurrentWorkspaceId,
} from "../hooks/useTasks";
import { TasksFilterBar } from "../components/TasksFilterBar";
import { TaskCard } from "../components/TaskCard";
import { TaskTable } from "../components/TaskTable";
import { BoardView } from "../components/BoardView";
import { GanttView } from "../components/GanttView";
import { TaskModal } from "../components/TaskModal";
import { BulkActionBar } from "../components/BulkActionBar";
import { SavedViewBar } from "@/features/saved-views/components/SavedViewBar";
import type { TaskFormValues } from "../components/TaskForm";
import { PageHeader } from "@/components/ui/page-header";
import { http } from "@/services/http";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import { useUiStore } from "@/store/ui.store";

export function TasksPage() {
  const workspaceId = useCurrentWorkspaceId();
  const { canWrite } = useCurrentMembership();
  const filters = useFiltersStore();
  const search = useDebounce(filters.search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const { selectedIds, toggle } = useSelectionStore();
  const taskModalRequest = useUiStore((s) => s.taskModalRequest);
  const consumeTaskModalRequest = useUiStore((s) => s.consumeTaskModalRequest);

  const { data, isLoading, isError } = useTasks({
    status: filters.status === "ALL" ? undefined : filters.status,
    priority: filters.priority === "ALL" ? undefined : filters.priority,
    search,
    onlyMine: filters.onlyMine || undefined,
    onlyOverdue: filters.onlyOverdue || undefined,
    pageSize: 100,
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const tasks = useMemo(
    () =>
      [...(data?.items ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [data?.items],
  );

  const handleCreate = async (values: TaskFormValues) => {
    const { subtasks: newSubtasks, ...taskInput } = values;
    const created = await createTask.mutateAsync({
      ...taskInput,
      dueDate: taskInput.dueDate || null,
      startDate: taskInput.startDate || null,
      categoryId: taskInput.categoryId || null,
    });
    for (const st of newSubtasks) {
      await http.post(
        `/workspaces/${workspaceId}/tasks/${created.id}/subtasks`,
        { title: st.title },
      );
    }
  };

  const handleEdit = async (values: TaskFormValues) => {
    if (!editing) return;
    const { subtasks: newSubtasks, ...taskInput } = values;
    await updateTask.mutateAsync({
      id: editing.id,
      input: {
        ...taskInput,
        dueDate: taskInput.dueDate || null,
        startDate: taskInput.startDate || null,
        categoryId: taskInput.categoryId || null,
      },
    });
    for (const st of newSubtasks) {
      await http.post(
        `/workspaces/${workspaceId}/tasks/${editing.id}/subtasks`,
        { title: st.title },
      );
    }
  };

  const handleToggleComplete = (task: Task) => {
    const nextStatus = task.status === "DONE" ? "TODO" : "DONE";
    updateTask.mutate({
      id: task.id,
      input: {
        status: nextStatus,
        completedAt: nextStatus === "DONE" ? new Date().toISOString() : null,
      },
    });
  };

  const handleDelete = (task: Task) => {
    if (window.confirm(`¿Eliminar la tarea "${task.title}"?`)) {
      deleteTask.mutate(task.id);
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTask.mutate({
      id: taskId,
      input: {
        status: newStatus,
        completedAt: newStatus === "DONE" ? new Date().toISOString() : null,
      },
    });
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setModalOpen(true);
  };

  useEffect(() => {
    if (!taskModalRequest) return;
    if (taskModalRequest.mode === "create") {
      if (canWrite) {
        setEditing(null);
        setModalOpen(true);
      }
    } else {
      setEditing(taskModalRequest.task);
      setModalOpen(true);
    }
    consumeTaskModalRequest();
  }, [taskModalRequest, canWrite, consumeTaskModalRequest]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tareas"
        description={workspaceId ? undefined : "Cargando workspace…"}
        action={
          canWrite && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Nueva tarea
            </Button>
          )
        }
      />

      <TasksFilterBar />

      <SavedViewBar />

      <BulkActionBar />

      <div className="flex justify-end gap-1">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            variant={filters.view === v.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => filters.setView(v.value)}
            aria-label={v.label}
          >
            <v.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{v.label}</span>
          </Button>
        ))}
      </div>

      {isLoading && <PageLoader />}

      {isError && (
        <EmptyState
          title="No se pudieron cargar las tareas"
          description="Revisa tu conexión e inténtalo de nuevo"
        />
      )}

      {!isLoading && !isError && tasks.length === 0 && (
        <EmptyState
          title="Sin tareas"
          description="Crea tu primera tarea para empezar a organizarte"
          action={
            canWrite && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Crear tarea
              </Button>
            )
          }
        />
      )}

      {filters.view === "cards" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={handleToggleComplete}
              onEdit={openEdit}
              onDelete={handleDelete}
              selected={selectedIds.has(task.id)}
              onSelect={toggle}
              disabled={!canWrite}
            />
          ))}
        </div>
      )}

      {filters.view === "table" && (
        <TaskTable
          tasks={tasks}
          onToggleComplete={handleToggleComplete}
          onEdit={openEdit}
          onDelete={handleDelete}
          selectedIds={selectedIds}
          onToggleSelect={toggle}
          disabled={!canWrite}
        />
      )}

      {filters.view === "board" && (
        <BoardView
          tasks={tasks}
          onEdit={openEdit}
          onStatusChange={handleStatusChange}
          readOnly={!canWrite}
        />
      )}

      {filters.view === "gantt" && (
        <GanttView tasks={tasks} onEdit={openEdit} readOnly={!canWrite} />
      )}

      {(createTask.isPending || updateTask.isPending) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Guardando…
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editing}
        onSubmit={editing ? handleEdit : handleCreate}
        submitting={createTask.isPending || updateTask.isPending}
      />
    </div>
  );
}

const VIEWS = [
  { value: "cards", label: "Tarjetas", icon: LayoutGrid },
  { value: "table", label: "Tabla", icon: Rows3 },
  { value: "board", label: "Board", icon: Kanban },
  { value: "gantt", label: "Gantt", icon: BarChart3 },
] as const;
