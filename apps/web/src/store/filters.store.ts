import { create } from "zustand";
import type { Priority, TaskStatus } from "@taskmaster/contracts";

export interface TaskFiltersState {
  status: TaskStatus | "ALL";
  priority: Priority | "ALL";
  search: string;
  onlyMine: boolean;
  onlyOverdue: boolean;
  view: "cards" | "table" | "board" | "gantt";
  setStatus: (status: TaskStatus | "ALL") => void;
  setPriority: (priority: Priority | "ALL") => void;
  setSearch: (search: string) => void;
  toggleOnlyMine: () => void;
  toggleOnlyOverdue: () => void;
  setView: (view: "cards" | "table" | "board" | "gantt") => void;
  reset: () => void;
}

const initialState = {
  status: "ALL" as const,
  priority: "ALL" as const,
  search: "",
  onlyMine: false,
  onlyOverdue: false,
  view: "cards" as const,
};

export const useFiltersStore = create<TaskFiltersState>()((set) => ({
  ...initialState,
  setStatus: (status) => set({ status }),
  setPriority: (priority) => set({ priority }),
  setSearch: (search) => set({ search }),
  toggleOnlyMine: () => set((s) => ({ onlyMine: !s.onlyMine })),
  toggleOnlyOverdue: () => set((s) => ({ onlyOverdue: !s.onlyOverdue })),
  setView: (view) => set({ view }),
  reset: () => set({ ...initialState }),
}));
