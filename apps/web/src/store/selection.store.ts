import { create } from "zustand";

interface SelectionState {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  select: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  count: () => number;
  isAllSelected: (ids: string[]) => boolean;
}

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  selectedIds: new Set<string>(),

  toggle: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),

  toggleAll: (ids) =>
    set((s) => {
      const allSelected = ids.every((id) => s.selectedIds.has(id));
      if (allSelected) {
        return { selectedIds: new Set<string>() };
      }
      return { selectedIds: new Set(ids) };
    }),

  select: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.add(id);
      return { selectedIds: next };
    }),

  clear: () => set({ selectedIds: new Set<string>() }),

  isSelected: (id) => get().selectedIds.has(id),

  count: () => get().selectedIds.size,

  isAllSelected: (ids) =>
    ids.length > 0 && ids.every((id) => get().selectedIds.has(id)),
}));
