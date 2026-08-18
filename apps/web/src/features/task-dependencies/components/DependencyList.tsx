import type { Task, TaskDependency } from "@taskmaster/contracts";
import { X } from "lucide-react";
import { StatusBadge } from "@/features/tasks/components/StatusBadge";
import { useDeleteTaskDependency } from "../hooks/useTaskDependencies";

interface DependencyListProps {
  taskId: string;
  dependencies: TaskDependency[] | undefined;
  tasks: Task[];
}

export function DependencyList({
  taskId,
  dependencies,
  tasks,
}: DependencyListProps) {
  const deleteMut = useDeleteTaskDependency(taskId);

  if (!dependencies || dependencies.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin dependencias. Agrega una para enlazar tareas.
      </p>
    );
  }

  const blocking = dependencies.filter((d) => d.fromTaskId === taskId);
  const blockedBy = dependencies.filter((d) => d.toTaskId === taskId);

  function renderDep(dep: TaskDependency, type: "blocking" | "blockedBy") {
    const relatedTask = type === "blocking" ? dep.toTask : dep.fromTask;
    const taskData =
      relatedTask ??
      tasks.find(
        (t) => t.id === (type === "blocking" ? dep.toTaskId : dep.fromTaskId),
      );
    if (!taskData) return null;

    return (
      <div
        key={dep.id}
        className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-sm"
      >
        <span className="flex-1 truncate">{taskData.title}</span>
        {taskData.status && <StatusBadge status={taskData.status} />}
        <button
          type="button"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => deleteMut.mutate(dep.id)}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blocking.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Bloquea a</p>
          {blocking.map((d) => renderDep(d, "blocking"))}
        </div>
      )}

      {blockedBy.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Bloqueado por
          </p>
          {blockedBy.map((d) => renderDep(d, "blockedBy"))}
        </div>
      )}
    </div>
  );
}
