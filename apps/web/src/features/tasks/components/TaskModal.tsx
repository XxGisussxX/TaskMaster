import type { Task } from "@taskmaster/contracts";
import { Dialog } from "@/components/ui/dialog";
import { TaskForm, type TaskFormValues } from "./TaskForm";
import { CommentSection } from "./CommentSection";

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
  onSubmit: (values: TaskFormValues) => Promise<void>;
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
      className={task ? "max-w-2xl" : undefined}
    >
      <TaskForm
        task={task}
        onSubmit={async (values) => {
          await onSubmit(values);
          onOpenChange(false);
        }}
        submitting={submitting}
      />

      {task && (
        <>
          <hr className="my-5 border-border" />
          <CommentSection taskId={task.id} />
        </>
      )}
    </Dialog>
  );
}
