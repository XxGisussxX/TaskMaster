import { useEffect, useState } from "react";
import type { AiCapabilities } from "@taskmaster/contracts";
import { loadAiCapabilities } from "../lib/capabilities";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";

/**
 * Si hay IA operativa en el workspace activo.
 *
 * `configured === null` significa "todavía consultando", que no es lo mismo que
 * "no hay": la UI usa ese estado para no parpadear. La carga vive en el hook y el
 * caché en `lib/capabilities.ts`.
 */
export function useAiCapabilities(): AiCapabilities | null {
  const workspaceId = useCurrentWorkspaceId();
  const [capabilities, setCapabilities] = useState<AiCapabilities | null>(null);

  useEffect(() => {
    // Al cambiar de workspace se vuelve a `null` para no mostrar durante un
    // frame el estado del anterior.
    setCapabilities(null);
    if (!workspaceId) return;

    let alive = true;
    void loadAiCapabilities(workspaceId).then((result) => {
      if (alive) setCapabilities(result);
    });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  return capabilities;
}
