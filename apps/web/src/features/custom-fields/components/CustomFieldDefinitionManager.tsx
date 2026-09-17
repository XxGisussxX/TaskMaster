import { useState } from "react";
import {
  Pencil,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CustomFieldType } from "@taskmaster/contracts";
import type { CustomFieldDefinition } from "@taskmaster/contracts";
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
  useReorderCustomFieldDefinitions,
} from "../hooks/useCustomFields";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";

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
  options: string;
}

const emptyForm: DefinitionFormState = {
  name: "",
  type: CustomFieldType.TEXT,
  required: false,
  options: "",
};

function SortableDefinitionRow({
  definition,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  readOnly,
}: {
  definition: CustomFieldDefinition;
  onEdit: (def: CustomFieldDefinition) => void;
  onDelete: (def: CustomFieldDefinition) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  readOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: definition.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border p-2",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/30",
      )}
    >
      <button
        type="button"
        aria-label="Arrastrar para reordenar"
        className={cn(
          "cursor-grab text-muted-foreground active:cursor-grabbing",
          readOnly && "invisible",
        )}
        {...(readOnly ? {} : attributes)}
        {...(readOnly ? {} : listeners)}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-sm font-medium">{definition.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {FIELD_TYPES.find((ft) => ft.value === definition.type)?.label}
        </span>
        {definition.required && (
          <span className="shrink-0 text-xs text-destructive">Requerido</span>
        )}
        {definition.options && definition.options.length > 0 && (
          <span className="truncate text-xs text-muted-foreground">
            ({definition.options.join(", ")})
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {!readOnly && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Subir (accesible)"
              onClick={() => onMoveUp(definition.id)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Bajar (accesible)"
              onClick={() => onMoveDown(definition.id)}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Editar"
              onClick={() => onEdit(definition)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Eliminar"
              onClick={() => onDelete(definition)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function CustomFieldDefinitionManager() {
  const { data: definitions = [] } = useCustomFieldDefinitions();
  const createMutation = useCreateCustomFieldDefinition();
  const updateMutation = useUpdateCustomFieldDefinition();
  const deleteMutation = useDeleteCustomFieldDefinition();
  const reorderMutation = useReorderCustomFieldDefinitions();
  const { canWrite } = useCurrentMembership();

  const [form, setForm] = useState<DefinitionFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const sorted = [...definitions].sort((a, b) => a.order - b.order);

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
      order: editingId
        ? (definitions.find((d) => d.id === editingId)?.order ?? 0)
        : 0,
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
      options: (def.options ?? []).join(", "),
    });
  };

  const confirmDelete = (def: CustomFieldDefinition) => {
    const ok = window.confirm(
      `¿Eliminar el campo «${def.name}» junto con todos sus valores? Esta acción no se puede deshacer.`,
    );
    if (ok) deleteMutation.mutate(def.id);
  };

  const persistOrder = (ordered: CustomFieldDefinition[]) => {
    reorderMutation.mutate(ordered.map((d) => d.id));
  };

  const moveUp = (id: string) => {
    const index = sorted.findIndex((d) => d.id === id);
    if (index <= 0) return;
    persistOrder(arrayMove(sorted, index, index - 1));
  };

  const moveDown = (id: string) => {
    const index = sorted.findIndex((d) => d.id === id);
    if (index === -1 || index >= sorted.length - 1) return;
    persistOrder(arrayMove(sorted, index, index + 1));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const from = sorted.findIndex((d) => d.id === active.id);
    const to = sorted.findIndex((d) => d.id === over.id);
    if (from === -1 || to === -1) return;

    persistOrder(arrayMove(sorted, from, to));
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
        {canWrite && (
          <>
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
                  onChange={(e) =>
                    setForm({ ...form, options: e.target.value })
                  }
                  className="col-span-2"
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.required}
                  onChange={(e) =>
                    setForm({ ...form, required: e.target.checked })
                  }
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
          </>
        )}

        {sorted.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={sorted.map((d) => d.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {sorted.map((def) => (
                  <SortableDefinitionRow
                    key={def.id}
                    definition={def}
                    onEdit={startEdit}
                    onDelete={confirmDelete}
                    onMoveUp={moveUp}
                    onMoveDown={moveDown}
                    readOnly={!canWrite}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
        {sorted.length > 1 && canWrite && (
          <p className="text-xs text-muted-foreground">
            Arrastrá las filas para reordenarlas o usá las flechas.
          </p>
        )}
        {activeId ? <div className="sr-only">Reordenando…</div> : null}
      </CardContent>
    </Card>
  );
}
