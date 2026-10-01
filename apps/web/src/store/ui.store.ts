import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Note, Task } from "@taskmaster/contracts";

export type Theme = "light" | "dark" | "system";

export type TaskModalRequest =
  { mode: "create"; ai?: boolean } | { mode: "edit"; task: Task };

interface UiState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  theme: Theme;
  taskModalRequest: TaskModalRequest | null;
  noteCreateRequest: boolean;
  noteOpenRequest: Note | null;
  assistantDraft: string | null;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setTheme: (theme: Theme) => void;
  requestTaskModal: (request: TaskModalRequest) => void;
  consumeTaskModalRequest: () => void;
  requestNoteCreate: () => void;
  consumeNoteCreate: () => void;
  requestNoteOpen: (note: Note) => void;
  consumeNoteOpen: () => void;
  requestAssistantDraft: (draft: string) => void;
  consumeAssistantDraft: () => void;
}

function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      commandPaletteOpen: false,
      theme: "system",
      taskModalRequest: null,
      noteCreateRequest: false,
      noteOpenRequest: null,
      assistantDraft: null,
      toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.classList.toggle(
          "dark",
          resolveTheme(theme) === "dark",
        );
      },
      requestTaskModal: (request) => set({ taskModalRequest: request }),
      consumeTaskModalRequest: () => set({ taskModalRequest: null }),
      requestNoteCreate: () => set({ noteCreateRequest: true }),
      consumeNoteCreate: () => set({ noteCreateRequest: false }),
      requestNoteOpen: (note) => set({ noteOpenRequest: note }),
      consumeNoteOpen: () => set({ noteOpenRequest: null }),
      requestAssistantDraft: (draft) => set({ assistantDraft: draft }),
      consumeAssistantDraft: () => set({ assistantDraft: null }),
    }),
    {
      name: "taskmaster.ui",
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen, theme: s.theme }),
    },
  ),
);

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(theme) === "dark",
  );
}
