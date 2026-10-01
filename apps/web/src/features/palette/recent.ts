import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NoteType, TaskStatus } from "@taskmaster/contracts";
import {
  NoteType as NoteTypeEnum,
  TaskStatus as TaskStatusEnum,
} from "@taskmaster/contracts";

/** Recurso visitado recientemente y mostrado en la paleta. */
export type RecentEntry =
  | { kind: "route"; id: string; label: string; path: string }
  | {
      kind: "task";
      id: string;
      title: string;
      status: TaskStatus;
      updatedAt: string;
    }
  | {
      kind: "note";
      id: string;
      title: string;
      type: NoteType;
      updatedAt: string;
    };

interface RecentState {
  entries: RecentEntry[];
  /** Agrega o re-acomoda una entrada (dedupe por tipo+id, tope por MAX_RECENT). */
  record: (entry: RecentEntry) => void;
  remove: (kind: RecentEntry["kind"], id: string) => void;
  clear: () => void;
}

export const MAX_RECENT = 8;

export const DEFAULT_RECENT: RecentEntry[] = [
  { kind: "route", id: "/", label: "Dashboard", path: "/" },
  { kind: "route", id: "/tasks", label: "Tareas", path: "/tasks" },
  { kind: "route", id: "/notes", label: "Notas", path: "/notes" },
  { kind: "route", id: "/calendar", label: "Calendario", path: "/calendar" },
];

const keyOf = (entry: RecentEntry) => `${entry.kind}:${entry.id}`;

/**
 * Historial local de navegación de la paleta. Persistido en localStorage con
 * el mismo patrón (`zustand/persist`) que `useUiStore`.
 */
export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      entries: DEFAULT_RECENT,
      record: (entry) =>
        set((state) => {
          const key = keyOf(entry);
          const rest = state.entries.filter((e) => keyOf(e) !== key);
          return { entries: [entry, ...rest].slice(0, MAX_RECENT) };
        }),
      remove: (kind, id) =>
        set((state) => ({
          entries: state.entries.filter(
            (e) => !(e.kind === kind && e.id === id),
          ),
        })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: "taskmaster.palette.recent",
      partialize: (s) => ({ entries: s.entries }),
    },
  ),
);

export const RECENT_STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatusEnum.TODO]: "Por hacer",
  [TaskStatusEnum.IN_PROGRESS]: "En curso",
  [TaskStatusEnum.IN_REVIEW]: "En revisión",
  [TaskStatusEnum.DONE]: "Completada",
  [TaskStatusEnum.ARCHIVED]: "Archivada",
};

export const RECENT_NOTE_TYPE_LABEL: Record<NoteType, string> = {
  [NoteTypeEnum.STANDARD]: "Nota",
  [NoteTypeEnum.CHECKLIST]: "Lista",
  [NoteTypeEnum.IDEA]: "Idea",
  [NoteTypeEnum.MEETING]: "Reunión",
  [NoteTypeEnum.STICKY]: "Pegatina",
};

export function recentEntryId(entry: RecentEntry): string {
  return keyOf(entry);
}
