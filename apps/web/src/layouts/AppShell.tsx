import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Header } from "./components/Header";
import { CommandPalette } from "./components/CommandPalette";
import { AiAssistant } from "@/features/ai/components/AiAssistant";
import { UnverifiedBanner } from "@/features/auth/components/UnverifiedBanner";
import { useThemeSync, useGlobalHotkeys } from "@/hooks/useAppHooks";
import { usePaletteCommands } from "@/features/palette/usePaletteCommands";
import { useRecentStore } from "@/features/palette/recent";
import { NAV_ITEMS } from "@/app/nav";
import { useUiStore } from "@/store/ui.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useWorkspaces } from "@/features/workspace/hooks/useWorkspaces";
import { useSocket } from "@/hooks/useSocket";

export function AppShell() {
  useThemeSync();
  useGlobalHotkeys();
  usePaletteCommands();
  useSocket();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const { currentWorkspaceId, setCurrentWorkspaceId } = useWorkspaceStore();
  const { data: workspaces, isSuccess: workspacesLoaded } = useWorkspaces();
  const location = useLocation();
  const recordRecent = useRecentStore((s) => s.record);

  useEffect(() => {
    const navItem = NAV_ITEMS.find((item) => item.to === location.pathname);
    if (!navItem) return;
    recordRecent({
      kind: "route",
      id: navItem.to,
      label: navItem.label,
      path: navItem.to,
    });
  }, [location.pathname, recordRecent]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [setSidebarOpen]);

  useEffect(() => {
    // Se espera a que la lista haya resuelto, no a que exista: si el usuario ya
    // no pertenece al workspace guardado (fue borrado, o la base se reseedeó),
    // la lista llega vacía y hay que soltar el id igual. Sin esto el id muerto
    // sobrevive en localStorage y cada query del workspace responde 404 para
    // siempre.
    if (!workspacesLoaded) return;
    const realIds = new Set((workspaces ?? []).map((w) => w.id));
    if (currentWorkspaceId && realIds.has(currentWorkspaceId)) return;
    setCurrentWorkspaceId(workspaces?.[0]?.id ?? null);
  }, [currentWorkspaceId, workspaces, workspacesLoaded, setCurrentWorkspaceId]);

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <UnverifiedBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <CommandPalette />
      <AiAssistant />
    </div>
  );
}
