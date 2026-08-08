import { useState } from "react";
import { Plus } from "lucide-react";
import { NoteType } from "@taskmaster/contracts";
import type { Note } from "@taskmaster/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { NoteCard } from "../components/NoteCard";
import { NoteForm, type NoteFormValues } from "../components/NoteForm";
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
} from "../hooks/useNotes";

export function NotesPage() {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);

  const { data, isLoading } = useNotes({
    type: typeFilter === "ALL" ? undefined : typeFilter,
    search,
  });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const notes = data?.items ?? [];

  const handleSubmit = (values: NoteFormValues) => {
    if (editing) {
      updateNote.mutate({ id: editing.id, input: values });
    } else {
      createNote.mutate({ ...values, items: [] });
    }
    setModalOpen(false);
  };

  const handleDelete = (note: Note) => {
    if (window.confirm(`¿Eliminar la nota "${note.title ?? "sin título"}"?`)) {
      deleteNote.mutate(note.id);
    }
  };

  const handleTogglePin = (note: Note) => {
    updateNote.mutate({ id: note.id, input: { pinned: !note.pinned } });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notas"
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Nueva nota
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar notas…"
          className="min-w-[200px] max-w-sm flex-1"
        />
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-[160px]"
          aria-label="Filtrar por tipo"
        >
          <option value="ALL">Todos los tipos</option>
          {Object.values(NoteType).map((t) => (
            <option key={t} value={t}>
              {t.toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <PageLoader />}

      {!isLoading && notes.length === 0 && (
        <EmptyState
          title="Sin notas"
          description="Crea una nota estándar, lista, idea, reunión o pegatina"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Crear nota
            </Button>
          }
        />
      )}

      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
        {notes.map((note) => (
          <div key={note.id} className="mb-3 break-inside-avoid">
            <NoteCard
              note={note}
              onEdit={(n) => {
                setEditing(n);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
            />
          </div>
        ))}
      </div>

      <Dialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Editar nota" : "Nueva nota"}
      >
        <NoteForm
          note={editing}
          onSubmit={handleSubmit}
          submitting={createNote.isPending || updateNote.isPending}
        />
      </Dialog>
    </div>
  );
}
