import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (id: string) => void;
  clearCurrentWorkspaceId: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (id) => set({ currentWorkspaceId: id }),
      clearCurrentWorkspaceId: () => set({ currentWorkspaceId: null }),
    }),
    { name: "taskmaster.workspace" },
  ),
);
