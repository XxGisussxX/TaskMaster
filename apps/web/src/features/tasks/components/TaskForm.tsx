import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Priority, TaskStatus } from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

const formSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido"),
  description: z.string().optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(Priority),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
});

export type TaskFormValues = z.infer<typeof formSchema>;

const STATUS_OPTIONS = Object.values(TaskStatus);
const PRIORITY_OPTIONS = Object.values(Priority);

export function TaskForm({
  task,
  onSubmit,
  submitting,
}: {
  task?: Task | null;
  onSubmit: (values: TaskFormValues) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? TaskStatus.TODO,
      priority: task?.priority ?? Priority.MEDIUM,
      dueDate: task?.dueDate ?? null,
      startDate: task?.startDate ?? null,
    },
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        startDate: task.startDate,
      });
    }
  }, [task, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          placeholder="Ej. Enviar propuesta al cliente"
          {...register("title")}
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          placeholder="Detalles opcionales…"
          {...register("description")}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select id="status" {...register("status")}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="priority">Prioridad</Label>
          <Select id="priority" {...register("priority")}>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dueDate">Fecha de vencimiento</Label>
          <Input id="dueDate" type="date" {...register("dueDate")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Fecha de inicio</Label>
          <Input id="startDate" type="date" {...register("startDate")} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Guardando…" : task ? "Guardar cambios" : "Crear tarea"}
      </Button>
    </form>
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
