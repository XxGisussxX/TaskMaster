import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateTimeEntry } from "../hooks/useTimeEntries";

interface TimeEntryFormProps {
  taskId: string;
  onSubmit?: () => void;
}

type FormValues = {
  description: string;
  date: string;
  startTime: string;
  endTime: string;
};

export function TimeEntryForm({ taskId, onSubmit }: TimeEntryFormProps) {
  const createEntry = useCreateTimeEntry();

  const { register, handleSubmit, watch, reset } = useForm<FormValues>({
    defaultValues: {
      description: "",
      date: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "",
    },
  });

  const startTime = watch("startTime");
  const endTime = watch("endTime");

  let computedDuration = "";
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (
      sh !== undefined &&
      sm !== undefined &&
      eh !== undefined &&
      em !== undefined
    ) {
      const diffMin = eh * 60 + em - (sh * 60 + sm);
      if (diffMin > 0) {
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        computedDuration = `${h}h ${m}m`;
      }
    }
  }

  async function handleFormSubmit(values: FormValues) {
    const [sh, sm] = values.startTime.split(":").map(Number);
    const [eh, em] = values.endTime.split(":").map(Number);

    if (
      sh === undefined ||
      sm === undefined ||
      eh === undefined ||
      em === undefined
    )
      return;

    const startDate = new Date(values.date);
    startDate.setHours(sh, sm, 0, 0);

    const endDate = new Date(values.date);
    endDate.setHours(eh, em, 0, 0);

    await createEntry.mutateAsync({
      taskId,
      description: values.description,
      startedAt: startDate.toISOString(),
      stoppedAt: endDate.toISOString(),
    });

    reset();
    onSubmit?.();
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="te-desc">Descripción</Label>
        <Input
          id="te-desc"
          placeholder="Ej: Revisión de código"
          {...register("description")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="te-date">Fecha</Label>
        <Input id="te-date" type="date" {...register("date")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="te-start">Hora inicio</Label>
          <Input id="te-start" type="time" {...register("startTime")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="te-end">Hora fin</Label>
          <Input id="te-end" type="time" {...register("endTime")} />
        </div>
      </div>
      {computedDuration && (
        <p className="text-sm text-muted-foreground">
          Duración: {computedDuration}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={createEntry.isPending}>
          {createEntry.isPending ? "Guardando..." : "Guardar entrada"}
        </Button>
      </div>
    </form>
  );
}
