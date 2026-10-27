import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChecklistItemDto, Note } from "@taskmaster/contracts";
import { getChecklistProgress } from "@taskmaster/domain";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  useAddChecklistItem,
  useRemoveChecklistItem,
  useToggleChecklistItem,
} from "../hooks/useNotes";

/**
 * Editor de los ítems de una nota de tipo lista.
 *
 * Cada cambio se guarda contra `/notes/:id/checklist` apenas ocurre, igual que
 * los adjuntos y los campos personalizados del formulario: no hace falta
 * "Guardar cambios" ni reenviar el contenido completo de la nota. El estado
 * local existe para que el tilde responda al instante; la invalidación de la
 * query actualiza la tarjeta y el contador del tablero.
 */
export function NoteChecklist({
  note,
  readOnly = false,
}: {
  note: Note;
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<ChecklistItemDto[]>(note.items);
  const [draft, setDraft] = useState("");
  const addItem = useAddChecklistItem();
  const toggleItem = useToggleChecklistItem();
  const removeItem = useRemoveChecklistItem();

  // Al abrir otra nota el formulario no se remonta (el diálogo es el mismo),
  // así que hay que volver a sincronizar la lista.
  useEffect(() => {
    setItems(note.items);
    setDraft("");
  }, [note.id, note.items]);

  const progress = getChecklistProgress(items);

  const handleAdd = () => {
    const text = draft.trim();
    if (!text || readOnly) return;
    addItem.mutate(
      { noteId: note.id, text },
      {
        onSuccess: (item) => {
          setItems((prev) => [...prev, item]);
          setDraft("");
        },
      },
    );
  };

  const handleToggle = (item: ChecklistItemDto, done: boolean) => {
    if (!item.id || readOnly) return;
    const id = item.id;
    setItems((prev) =>
      prev.map((candidate) =>
        candidate.id === id ? { ...candidate, done } : candidate,
      ),
    );
    toggleItem.mutate(
      { noteId: note.id, itemId: id, done },
      {
        // Si la API rechaza el cambio, se deshace el tilde optimista.
        onError: () =>
          setItems((prev) =>
            prev.map((candidate) =>
              candidate.id === id ? { ...candidate, done: !done } : candidate,
            ),
          ),
      },
    );
  };

  const handleRemove = (item: ChecklistItemDto) => {
    if (!item.id || readOnly) return;
    const id = item.id;
    removeItem.mutate(
      { noteId: note.id, itemId: id },
      {
        onSuccess: () =>
          setItems((prev) => prev.filter((candidate) => candidate.id !== id)),
      },
    );
  };

  return (
    <div className="space-y-2">
      {items.length > 0 ? (
        <>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress.completed}/{progress.total}
            </span>
            <span>{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} />
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li
                key={item.id ?? index}
                className="group flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={item.done}
                  onChange={(event) => handleToggle(item, event.target.checked)}
                  disabled={readOnly || !item.id}
                  aria-label={`Marcar ${item.text}`}
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    item.done && "text-muted-foreground line-through",
                  )}
                >
                  {item.text}
                </span>
                {!readOnly && item.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Eliminar ${item.text}`}
                    onClick={() => handleRemove(item)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavía no hay elementos en esta lista.
        </p>
      )}

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                // Evita que el Enter dispare el submit del formulario de la nota.
                event.preventDefault();
                handleAdd();
              }
            }}
            placeholder="Agregar elemento…"
            maxLength={200}
            aria-label="Nuevo elemento de la lista"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!draft.trim() || addItem.isPending}
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
      )}
    </div>
  );
}
