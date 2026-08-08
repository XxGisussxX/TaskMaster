import { useEffect } from "react";
import { useUiStore, applyTheme } from "@/store/ui.store";
import { useHotkeys } from "@/hooks/useHotkeys";

export function useThemeSync() {
  const theme = useUiStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}

export function useGlobalHotkeys() {
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  useHotkeys("Mod+k", () => {
    setCommandPaletteOpen(true);
  });
}
