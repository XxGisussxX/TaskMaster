import { useEffect } from "react";

export function useHotkeys(
  key: string,
  handler: (e: KeyboardEvent) => void,
  deps: unknown[] = [],
) {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (key.startsWith("Mod+")) {
        if (!mod) return;
        if (e.key.toLowerCase() === key.slice(4).toLowerCase()) {
          e.preventDefault();
          handler(e);
        }
      } else if (e.key.toLowerCase() === key.toLowerCase()) {
        handler(e);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, key]);
}
