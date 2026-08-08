import { Priority, TaskStatus } from "@taskmaster/contracts";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useFiltersStore } from "@/store/filters.store";

export function TasksFilterBar() {
  const {
    status,
    priority,
    search,
    onlyMine,
    onlyOverdue,
    setStatus,
    setPriority,
    setSearch,
    toggleOnlyMine,
    toggleOnlyOverdue,
  } = useFiltersStore();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tareas…"
          className="pl-9"
        />
      </div>

      <Select
        value={status}
        onChange={(e) => setStatus(e.target.value as TaskStatus | "ALL")}
        className="w-[140px]"
        aria-label="Filtrar por estado"
      >
        <option value="ALL">Todo estado</option>
        {Object.values(TaskStatus).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </Select>

      <Select
        value={priority}
        onChange={(e) => setPriority(e.target.value as Priority | "ALL")}
        className="w-[140px]"
        aria-label="Filtrar por prioridad"
      >
        <option value="ALL">Toda prioridad</option>
        {Object.values(Priority).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </option>
        ))}
      </Select>

      <Button
        variant={onlyMine ? "default" : "outline"}
        size="sm"
        onClick={toggleOnlyMine}
      >
        Solo mías
      </Button>
      <Button
        variant={onlyOverdue ? "default" : "outline"}
        size="sm"
        onClick={toggleOnlyOverdue}
      >
        Vencidas
      </Button>
    </div>
  );
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "Por hacer",
  [TaskStatus.IN_PROGRESS]: "En curso",
  [TaskStatus.IN_REVIEW]: "En revisión",
  [TaskStatus.DONE]: "Completada",
  [TaskStatus.ARCHIVED]: "Archivada",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  [Priority.URGENT]: "Urgente",
  [Priority.HIGH]: "Alta",
  [Priority.MEDIUM]: "Media",
  [Priority.LOW]: "Baja",
};
