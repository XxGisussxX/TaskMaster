import { useState } from "react";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomFieldType } from "@taskmaster/contracts";
import type { CustomFieldDefinition } from "@taskmaster/contracts";
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
} from "../hooks/useCustomFields";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: CustomFieldType.TEXT, label: "Texto" },
  { value: CustomFieldType.NUMBER, label: "Número" },
  { value: CustomFieldType.DATE, label: "Fecha" },
  { value: CustomFieldType.SELECT, label: "Selección" },
  { value: CustomFieldType.MULTI_SELECT, label: "Selección múltiple" },
  { value: CustomFieldType.CHECKBOX, label: "Casilla" },
];

interface DefinitionFormState {
  name: string;
  type: CustomFieldType;
  required: boolean;
  order: number;
  options: string;
}

const emptyForm: DefinitionFormState = {
  name: "",
  type: CustomFieldType.TEXT,
  required: false,
  order: 0,
  options: "",
};

export function CustomFieldDefinitionManager() {
  const { data: definitions = [] } = useCustomFieldDefinitions();
  const createMutation = useCreateCustomFieldDefinition();
  const updateMutation = useUpdateCustomFieldDefinition();
  const deleteMutation = useDeleteCustomFieldDefinition();

  const [form, setForm] = useState<DefinitionFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = () => {
    const opts = form.options
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const needsOptions =
      form.type === CustomFieldType.SELECT ||
      form.type === CustomFieldType.MULTI_SELECT;

    const payload = {
      name: form.name,
      type: form.type,
      required: form.required,
      order: form.order,
      ...(needsOptions && opts.length > 0 ? { options: opts } : {}),
    };

    if (editingId) {
      updateMutation.mutate(
        { id: editingId, data: payload },
        { onSuccess: resetForm },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: resetForm });
    }
  };

  const startEdit = (def: CustomFieldDefinition) => {
    setEditingId(def.id);
    setForm({
      name: def.name,
      type: def.type,
      required: def.required,
      order: def.order,
      options: (def.options ?? []).join(", "),
    });
  };

  const needsOptions =
    form.type === CustomFieldType.SELECT ||
    form.type === CustomFieldType.MULTI_SELECT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campos personalizados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Nombre del campo"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Select
            value={form.type}
            onChange={(e) =>
              setForm({ ...form, type: e.target.value as CustomFieldType })
            }
          >
            {FIELD_TYPES.map((ft) => (
              <option key={ft.value} value={ft.value}>
                {ft.label}
              </option>
            ))}
          </Select>
          {needsOptions && (
            <Input
              placeholder="Opciones (separadas por coma)"
              value={form.options}
              onChange={(e) => setForm({ ...form, options: e.target.value })}
              className="col-span-2"
            />
          )}
          <Input
            type="number"
            placeholder="Orden"
            value={form.order}
            onChange={(e) =>
              setForm({ ...form, order: Number(e.target.value) })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.required}
              onChange={(e) => setForm({ ...form, required: e.target.checked })}
            />
            Requerido
          </label>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSubmit} disabled={!form.name}>
            {editingId ? "Actualizar" : "Agregar"}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
          )}
        </div>

        {definitions.length > 0 && (
          <div className="space-y-2">
            {definitions.map((def) => (
              <div
                key={def.id}
                className="flex items-center justify-between rounded-md border p-2"
              >
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{def.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {FIELD_TYPES.find((ft) => ft.value === def.type)?.label}
                  </span>
                  {def.required && (
                    <span className="text-xs text-destructive">Requerido</span>
                  )}
                  {def.options && def.options.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      ({def.options.join(", ")})
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(def)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(def.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
