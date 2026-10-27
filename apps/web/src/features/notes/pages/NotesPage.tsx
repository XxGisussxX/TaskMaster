import { useEffect, useState } from "react";
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
import { ErrorState } from "@/components/ui/error-state";
import { Pagination } from "@/components/ui/pagination";
import { useDebounce } from "@/hooks/useDebounce";
import { useUiStore } from "@/store/ui.store";
import { NoteCard } from "../components/NoteCard";
import { NoteForm, type NoteFormValues } from "../components/NoteForm";
import { useCustomFieldValuesMany } from "@/features/custom-fields/hooks/useCustomFields";
import { useCurrentMembership } from "@/features/workspace/hooks/useMembers";
import {
  useNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useToggleNotePin,
} from "../hooks/useNotes";

const NOTES_PAGE_SIZE = 24;

export function NotesPage() {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const { canWrite } = useCurrentMembership();
  const noteCreateRequest = useUiStore((s) => s.noteCreateRequest);
  const consumeNoteCreate = useUiStore((s) => s.consumeNoteCreate);
  const noteOpenRequest = useUiStore((s) => s.noteOpenRequest);
  const consumeNoteOpen = useUiStore((s) => s.consumeNoteOpen);

  const { data, isLoading, isError, refetch } = useNotes({
    type: typeFilter === "ALL" ? undefined : typeFilter,
    search: debouncedSearch,
    page,
    pageSize: NOTES_PAGE_SIZE,
  });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const togglePin = useToggleNotePin();

  const notes = data?.items ?? [];
  const { data: valuesByNote = {} } = useCustomFieldValuesMany(
    "note",
    notes.map((n) => n.id),
  );

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
    togglePin.mutate(note);
  };

  useEffect(() => {
    if (!noteCreateRequest) return;
    if (canWrite) {
      setEditing(null);
      setModalOpen(true);
    }
    consumeNoteCreate();
  }, [noteCreateRequest, canWrite, consumeNoteCreate]);

  useEffect(() => {
    if (!noteOpenRequest) return;
    setEditing(noteOpenRequest);
    setModalOpen(true);
    consumeNoteOpen();
  }, [noteOpenRequest, consumeNoteOpen]);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, debouncedSearch]);

  useEffect(() => {
    if (data && data.totalPages > 0 && page > data.totalPages) {
      setPage(data.totalPages);
    }
  }, [data, page]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notas"
        action={
          canWrite && (
            <Button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nueva nota
            </Button>
          )
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

      {isError && !isLoading && (
        <ErrorState
          title="No se pudieron cargar las notas"
          onRetry={() => void refetch()}
        />
      )}

      {!isLoading && !isError && notes.length === 0 && (
        <EmptyState
          title="Sin notas"
          description="Crea una nota estándar, lista, idea, reunión o pegatina"
          action={
            canWrite && (
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
            )
          }
        />
      )}

      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4">
        {notes.map((note) => (
          <div key={note.id} className="mb-3 break-inside-avoid">
            <NoteCard
              key={note.id}
              note={note}
              customValues={valuesByNote[note.id]}
              onEdit={(n) => {
                setEditing(n);
                setModalOpen(true);
              }}
              onDelete={handleDelete}
              onTogglePin={handleTogglePin}
              disabled={!canWrite}
            />
          </div>
        ))}
      </div>

      {!isLoading && !isError && (
        <Pagination
          page={page}
          totalPages={data?.totalPages ?? 1}
          total={data?.total}
          onPageChange={setPage}
        />
      )}

      <Dialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Editar nota" : "Nueva nota"}
      >
        <NoteForm
          note={editing}
          onSubmit={handleSubmit}
          submitting={createNote.isPending || updateNote.isPending}
          disabled={!canWrite}
        />
      </Dialog>
    </div>
  );
}
