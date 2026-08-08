import type { Task } from "@taskmaster/contracts";
import { Dialog } from "@/components/ui/dialog";
import { TaskForm, type TaskFormValues } from "./TaskForm";

export function TaskModal({
  open,
  onOpenChange,
  task,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  onSubmit: (values: TaskFormValues) => void;
  submitting?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={task ? "Editar tarea" : "Nueva tarea"}
      description={
        task
          ? "Actualiza los detalles de la tarea"
          : "Crea una tarea y asígnala a tu equipo"
      }
    >
      <TaskForm
        task={task}
        onSubmit={(values) => {
          onSubmit(values);
          onOpenChange(false);
        }}
        submitting={submitting}
      />
    </Dialog>
  );
}
