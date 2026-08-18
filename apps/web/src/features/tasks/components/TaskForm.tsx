import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Priority,
  RecurrenceFrequency,
  TaskStatus,
} from "@taskmaster/contracts";
import type { Task } from "@taskmaster/contracts";
import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useTags, useCreateTag } from "../hooks/useTags";
import { useCategories, useCreateCategory } from "../hooks/useCategories";
import { useMembers } from "@/features/workspace/hooks/useMembers";
import { SubtaskList, type SubtaskDraft } from "./SubtaskList";
import { RecurrenceFields } from "./RecurrenceFields";

const formSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido"),
  description: z.string().max(20000).optional(),
  status: z.nativeEnum(TaskStatus),
  priority: z.nativeEnum(Priority),
  dueDate: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export type TaskFormValues = z.infer<typeof formSchema> & {
  tagIds: string[];
  assigneeIds: string[];
  isRecurring: boolean;
  recurrence: {
    frequency: RecurrenceFrequency;
    interval: number;
    endDate?: string | null;
  } | null;
  subtasks: SubtaskDraft[];
};

const STATUS_OPTIONS = Object.values(TaskStatus);
const PRIORITY_OPTIONS = Object.values(Priority);

export function TaskForm({
  task,
  templateData,
  onSubmit,
  submitting,
}: {
  task?: Task | null;
  templateData?: Record<string, unknown> | null;
  onSubmit: (values: TaskFormValues) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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
      categoryId: task?.categoryId ?? null,
    },
  });

  const [tagIds, setTagIds] = useState<string[]>(
    task?.tags?.map((t) => t.id) ?? [],
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    task?.assignees?.map((a) => a.id) ?? [],
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    task?.categoryId ?? null,
  );
  const [isRecurring, setIsRecurring] = useState(task?.isRecurring ?? false);
  const [recurrence, setRecurrence] = useState<{
    frequency: RecurrenceFrequency;
    interval: number;
    endDate?: string | null;
  }>(
    task?.recurrence ?? {
      frequency: RecurrenceFrequency.WEEKLY,
      interval: 1,
      endDate: null,
    },
  );
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);

  const { data: tags = [] } = useTags();
  const { data: categories = [] } = useCategories();
  const { data: members = [] } = useMembers();
  const createTag = useCreateTag();
  const createCategory = useCreateCategory();

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        startDate: task.startDate,
        categoryId: task.categoryId,
      });
      setTagIds(task.tags.map((t) => t.id));
      setAssigneeIds(task.assignees.map((a) => a.id));
      setCategoryId(task.categoryId);
      setIsRecurring(task.isRecurring);
      if (task.recurrence) setRecurrence(task.recurrence);
    }
  }, [task, reset]);

  useEffect(() => {
    if (templateData && !task) {
      reset({
        title: (templateData.title as string) ?? "",
        description: (templateData.description as string) ?? "",
        status: (templateData.status as TaskStatus) ?? TaskStatus.TODO,
        priority: (templateData.priority as Priority) ?? Priority.MEDIUM,
        dueDate: (templateData.dueDate as string) ?? null,
        startDate: (templateData.startDate as string) ?? null,
        categoryId: (templateData.categoryId as string) ?? null,
      });
      if (Array.isArray(templateData.tagIds))
        setTagIds(templateData.tagIds as string[]);
      if (Array.isArray(templateData.assigneeIds))
        setAssigneeIds(templateData.assigneeIds as string[]);
      if (templateData.categoryId)
        setCategoryId(templateData.categoryId as string);
      if (templateData.isRecurring)
        setIsRecurring(templateData.isRecurring as boolean);
      if (templateData.recurrence)
        setRecurrence(templateData.recurrence as typeof recurrence);
    }
  }, [templateData, task, reset]);

  function handleFormSubmit(values: TaskFormValues) {
    onSubmit({
      ...values,
      categoryId,
      tagIds,
      assigneeIds,
      isRecurring,
      recurrence: isRecurring ? recurrence : null,
      subtasks,
    });
  }

  function handleCreateTag(name: string) {
    createTag.mutate(
      { name },
      {
        onSuccess: (newTag) => {
          setTagIds((prev) => [...prev, newTag.id]);
        },
      },
    );
  }

  function handleCreateCategory(name: string) {
    createCategory.mutate(
      { name },
      {
        onSuccess: (newCat) => {
          setCategoryId(newCat.id);
        },
      },
    );
  }

  const tagOptions = tags.map((t) => ({
    value: t.id,
    label: t.name,
    color: t.color,
  }));

  const memberOptions = members.map((m) => ({
    value: m.userId,
    label: m.user?.name ?? m.user?.email ?? "Usuario",
    color: null,
  }));

  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
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
        <Label>Descripción</Label>
        <RichTextEditor
          value={watch("description") ?? ""}
          onChange={(val) => setValue("description", val)}
          placeholder="Detalles opcionales…"
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

      <div className="space-y-2">
        <Label>Categoría</Label>
        <Select
          value={categoryId ?? ""}
          onChange={(e) => setCategoryId(e.target.value || null)}
        >
          <option value="">Sin categoría</option>
          {categoryOptions.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const name = prompt("Nombre de la nueva categoría:");
            if (name?.trim()) handleCreateCategory(name.trim());
          }}
        >
          + Nueva categoría
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Etiquetas</Label>
        <MultiSelect
          options={tagOptions}
          selected={tagIds}
          onChange={setTagIds}
          placeholder="Seleccionar etiquetas…"
          onCreateNew={handleCreateTag}
          createLabel="Crear etiqueta"
        />
      </div>

      <div className="space-y-2">
        <Label>Asignados</Label>
        <MultiSelect
          options={memberOptions}
          selected={assigneeIds}
          onChange={setAssigneeIds}
          placeholder="Seleccionar miembros…"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Subtareas</Label>
        </div>
        <SubtaskList
          subtasks={subtasks}
          existingSubtasks={
            task?.subtasks?.map((s) => ({ id: s.id, title: s.title })) ?? []
          }
          onChange={setSubtasks}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Recurrente
          </Label>
          <button
            type="button"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isRecurring ? "bg-primary" : "bg-muted"
            }`}
            onClick={() => setIsRecurring(!isRecurring)}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                isRecurring ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {isRecurring && (
          <RecurrenceFields
            frequency={recurrence.frequency}
            interval={recurrence.interval}
            endDate={
              typeof recurrence.endDate === "string" ? recurrence.endDate : ""
            }
            onChange={setRecurrence}
          />
        )}
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
