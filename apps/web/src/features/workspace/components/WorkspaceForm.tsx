import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema } from "@taskmaster/contracts";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormValues = { name: string; slug?: string; icon?: string };

export function WorkspaceForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: { name?: string; icon?: string };
  onSubmit: (values: FormValues) => Promise<void>;
  submitting?: boolean;
}) {
  const isEditing = !!defaultValues;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: defaultValues ?? { name: "", icon: "" },
  });

  useEffect(() => {
    if (open) {
      reset(defaultValues ?? { name: "", icon: "" });
    }
  }, [open, defaultValues, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Editar workspace" : "Nuevo workspace"}
      description={
        isEditing
          ? "Actualiza el nombre o icono del workspace"
          : "Crea un nuevo workspace para tu equipo"
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ws-name">Nombre</Label>
          <Input id="ws-name" placeholder="Mi equipo" {...register("name")} />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-icon">Icono (emoji, opcional)</Label>
          <Input
            id="ws-icon"
            placeholder="🚀"
            maxLength={4}
            {...register("icon")}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {isEditing ? "Guardar" : "Crear"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
