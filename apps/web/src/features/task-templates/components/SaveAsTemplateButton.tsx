import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { useCreateTaskTemplate } from "../hooks/useTaskTemplates";

interface SaveAsTemplateButtonProps {
  data: Record<string, unknown>;
}

export function SaveAsTemplateButton({ data }: SaveAsTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createTemplate = useCreateTaskTemplate();

  const handleSave = () => {
    if (!name.trim()) return;
    createTemplate.mutate(
      { name: name.trim(), description: description.trim(), data },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
          setDescription("");
        },
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Save className="h-3.5 w-3.5" />
        Guardar como plantilla
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Guardar como plantilla"
        description="Guarda los datos actuales como una plantilla reutilizable"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="tpl-name" className="text-sm font-medium">
              Nombre
            </label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la plantilla"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="tpl-desc" className="text-sm font-medium">
              Descripción
            </label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
