import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createReminderSchema, ReminderRepeat } from "@taskmaster/contracts";
import { Bell, Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import {
  useReminders,
  useCreateReminder,
  useDeleteReminder,
} from "../hooks/useReminders";
import { formatDateISO } from "@/lib/date";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";

type FormValues = {
  title: string;
  triggerAt: string;
  repeat: ReminderRepeat;
};

function ReminderForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createReminder = useCreateReminder();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createReminderSchema),
    defaultValues: {
      title: "",
      triggerAt: "",
      repeat: ReminderRepeat.NONE,
    },
  });

  async function onSubmit(values: FormValues) {
    await createReminder.mutateAsync({
      ...values,
      triggerAt: new Date(values.triggerAt),
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Nuevo recordatorio"
      description="Configura un recordatorio para que te avise"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="r-title">Título</Label>
          <Input id="r-title" placeholder="Revisar PR" {...register("title")} />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-triggerAt">Fecha y hora</Label>
          <Input
            id="r-triggerAt"
            type="datetime-local"
            {...register("triggerAt")}
          />
          {errors.triggerAt && (
            <p className="text-sm text-destructive">
              {errors.triggerAt.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-repeat">Repetir</Label>
          <Select id="r-repeat" {...register("repeat")}>
            <option value={ReminderRepeat.NONE}>No repetir</option>
            <option value={ReminderRepeat.DAILY}>Diariamente</option>
            <option value={ReminderRepeat.WEEKLY}>Semanalmente</option>
            <option value={ReminderRepeat.MONTHLY}>Mensualmente</option>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={createReminder.isPending}>
            Crear
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ReminderList() {
  const { data: reminders = [], isLoading } = useReminders();
  const deleteReminder = useDeleteReminder();
  const { canWrite } = useCurrentMembership();
  const [formOpen, setFormOpen] = useState(false);

  function handleDelete(id: string) {
    if (window.confirm("¿Eliminar este recordatorio?")) {
      deleteReminder.mutate(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          Recordatorios ({reminders.length})
        </h3>
        {canWrite && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Nuevo
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      )}

      {!isLoading && reminders.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sin recordatorios próximos.
        </p>
      )}

      <div className="space-y-2">
        {reminders.map((reminder) => {
          const isPast = new Date(reminder.triggerAt) < new Date();
          const isSent = !!reminder.sentAt;
          return (
            <div
              key={reminder.id}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 ${
                isPast && !isSent ? "border-warning" : ""
              } ${isSent ? "opacity-60" : ""}`}
            >
              <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{reminder.title}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateISO(reminder.triggerAt)}
                  {reminder.repeat !== ReminderRepeat.NONE &&
                    ` · ${reminder.repeat.toLowerCase()}`}
                  {isSent && " · Enviado"}
                </p>
              </div>
              {canWrite && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleDelete(reminder.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ReminderForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
