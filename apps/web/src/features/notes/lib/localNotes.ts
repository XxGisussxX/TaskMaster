import type { ChecklistItemDto, Note, Paginated } from "@taskmaster/contracts";
import { NoteType, StickyColor } from "@taskmaster/contracts";
import { getLocalWorkspaceId } from "@/features/tasks/lib/localTasks";
import { sanitizeHtml } from "@/lib/sanitize-html";

const STORAGE_KEY = "taskmaster.local.notes";

type StoredNotes = Record<string, Note[]>;

function readStore(): StoredNotes {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as StoredNotes;
  } catch {
    return {};
  }
}

function writeStore(store: StoredNotes): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function seedNote(workspaceId: string): Note {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    workspaceId,
    authorId: "local-demo-user",
    type: NoteType.STANDARD,
    title: "Tu primera nota",
    content:
      "Esta nota se guarda localmente mientras la API no esté disponible.",
    color: StickyColor.YELLOW,
    pinned: false,
    tags: [],
    items: [],
    collaborators: [],
    createdAt: now,
    updatedAt: now,
  };
}

function cloneNote(note: Note): Note {
  return {
    ...note,
    tags: [...note.tags],
    items: note.items.map((item) => ({ ...item })),
    collaborators: [...note.collaborators],
  };
}

function ensureWorkspaceNotes(store: StoredNotes, workspaceId: string): Note[] {
  if (!store[workspaceId]) {
    store[workspaceId] = [seedNote(workspaceId)];
    writeStore(store);
  }
  return store[workspaceId]!;
}

function matchesQuery(
  note: Note,
  query: Record<string, string | boolean | number | undefined>,
): boolean {
  const type = query.type as NoteType | undefined;
  const search = String(query.search ?? "")
    .trim()
    .toLowerCase();
  const tag = String(query.tag ?? "")
    .trim()
    .toLowerCase();
  const pinned = query.pinned as boolean | undefined;

  if (type && note.type !== type) return false;
  if (typeof pinned === "boolean" && note.pinned !== pinned) return false;
  if (tag && !note.tags.some((t) => t.name.toLowerCase() === tag)) return false;

  if (search) {
    const haystack = `${note.title ?? ""} ${note.content ?? ""}`.toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  return true;
}

export function isLocalNotesWorkspace(workspaceId: string): boolean {
  return workspaceId === getLocalWorkspaceId();
}

export function listLocalNotes(
  workspaceId: string,
  query: Record<string, string | boolean | number | undefined> = {},
): Paginated<Note> {
  const store = readStore();
  const filtered = ensureWorkspaceNotes(store, workspaceId)
    .map(cloneNote)
    .filter((note) => matchesQuery(note, query))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const page = Number(query.page ?? 1) || 1;
  const pageSize = Number(query.pageSize ?? 24) || 24;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

export function getLocalNote(workspaceId: string, noteId: string): Note {
  const store = readStore();
  const note = ensureWorkspaceNotes(store, workspaceId)
    .map(cloneNote)
    .find((candidate) => candidate.id === noteId);
  if (!note) throw new Error("Nota no encontrada");
  return note;
}

export function createLocalNote(
  workspaceId: string,
  input: Record<string, unknown>,
): Note {
  const store = readStore();
  const notes = ensureWorkspaceNotes(store, workspaceId);
  const now = new Date().toISOString();

  const contentInput = input.content as string | null | undefined;
  const note: Note = {
    id: crypto.randomUUID(),
    workspaceId,
    authorId: "local-demo-user",
    type: (input.type ?? NoteType.STANDARD) as NoteType,
    title: (input.title as string | null | undefined) ?? null,
    content: contentInput == null ? null : sanitizeHtml(contentInput),
    color:
      (input.color as StickyColor | null | undefined) ?? StickyColor.YELLOW,
    pinned: Boolean(input.pinned ?? false),
    tags: [],
    items: Array.isArray(input.items) ? (input.items as Note["items"]) : [],
    collaborators: [],
    createdAt: now,
    updatedAt: now,
  };

  notes.unshift(note);
  writeStore(store);
  return cloneNote(note);
}

export function updateLocalNote(
  workspaceId: string,
  noteId: string,
  input: Record<string, unknown>,
): Note {
  const store = readStore();
  const notes = ensureWorkspaceNotes(store, workspaceId);
  const index = notes.findIndex((note) => note.id === noteId);

  if (index === -1) {
    throw new Error("Note not found");
  }

  const current = notes[index]!;
  const contentInput = input.content as string | null | undefined;
  const updated: Note = {
    ...current,
    type: (input.type as NoteType | undefined) ?? current.type,
    title: (input.title as string | null | undefined) ?? current.title,
    content:
      contentInput === undefined
        ? current.content
        : contentInput == null
          ? null
          : sanitizeHtml(contentInput),
    color: (input.color as StickyColor | null | undefined) ?? current.color,
    pinned: typeof input.pinned === "boolean" ? input.pinned : current.pinned,
    items: Array.isArray(input.items)
      ? (input.items as Note["items"])
      : current.items,
    updatedAt: new Date().toISOString(),
  };

  notes[index] = updated;
  writeStore(store);
  return cloneNote(updated);
}

/**
 * Devuelve la nota mutable del store junto con el store abierto para escritura.
 *
 * Las operaciones de checklist son puntuales (agregar, marcar, borrar un ítem)
 * y no pasan por el formulario, así que comparten este acceso para no repetir
 * la búsqueda ni olvidarse de tocar `updatedAt`.
 */
function openLocalNote(
  workspaceId: string,
  noteId: string,
): { store: StoredNotes; note: Note } {
  const store = readStore();
  const notes = ensureWorkspaceNotes(store, workspaceId);
  const note = notes.find((candidate) => candidate.id === noteId);
  if (!note) throw new Error("Nota no encontrada");
  return { store, note };
}

export function addLocalChecklistItem(
  workspaceId: string,
  noteId: string,
  text: string,
): ChecklistItemDto {
  const { store, note } = openLocalNote(workspaceId, noteId);
  const order =
    note.items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
  const item: ChecklistItemDto = {
    id: crypto.randomUUID(),
    text,
    done: false,
    order,
  };

  note.items = [...note.items, item];
  note.updatedAt = new Date().toISOString();
  writeStore(store);
  return { ...item };
}

export function toggleLocalChecklistItem(
  workspaceId: string,
  noteId: string,
  itemId: string,
  done: boolean,
): ChecklistItemDto {
  const { store, note } = openLocalNote(workspaceId, noteId);
  const item = note.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error("Elemento de checklist no encontrado");

  item.done = done;
  note.updatedAt = new Date().toISOString();
  writeStore(store);
  return { ...item };
}

export function removeLocalChecklistItem(
  workspaceId: string,
  noteId: string,
  itemId: string,
): { id: string } {
  const { store, note } = openLocalNote(workspaceId, noteId);
  note.items = note.items.filter((item) => item.id !== itemId);
  note.updatedAt = new Date().toISOString();
  writeStore(store);
  return { id: itemId };
}

export function removeLocalNote(workspaceId: string, noteId: string): void {
  const store = readStore();
  const notes = ensureWorkspaceNotes(store, workspaceId);
  store[workspaceId] = notes.filter((note) => note.id !== noteId);
  writeStore(store);
}
