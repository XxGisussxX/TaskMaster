import { create } from "zustand";
import {
  PRESENCE_SNAPSHOT_EVENT,
  presenceSnapshotSchema,
} from "@taskmaster/contracts";

/**
 * Presencia del workspace activo.
 *
 * Guarda el último snapshot que mandó el servidor, no un estado derivado local:
 * si cada cliente contara por su cuenta, dos pestañas abiertas disagrees
 * sobre quién está conectado y el conteo dependería de quién mira.
 */

interface PresenceState {
  activeUserIds: string[];
  activeCount: number;
  generatedAt: string | null;
  /** `false` hasta que llega el primer snapshot. */
  ready: boolean;
  setSnapshot: (input: unknown) => void;
  reset: () => void;
}

const EMPTY = {
  activeUserIds: [] as string[],
  activeCount: 0,
  generatedAt: null as string | null,
};

export const usePresenceStore = create<PresenceState>()((set) => ({
  ...EMPTY,
  ready: false,
  setSnapshot: (input) => {
    // Se valida porque el payload viene por la red: un snapshot corrupto o de
    // otra versión del cliente no debe romper la pantalla.
    const parsed = presenceSnapshotSchema.safeParse(input);
    if (!parsed.success) return;

    set({
      activeUserIds: parsed.data.activeUserIds,
      activeCount: parsed.data.activeCount,
      generatedAt: parsed.data.generatedAt,
      ready: true,
    });
  },
  reset: () => set({ ...EMPTY, ready: false }),
}));

/** Presencia que se aplica solo si el snapshot es del workspace visible. */
export function applyPresenceSnapshot(
  snapshot: unknown,
  currentWorkspaceId: string | null,
) {
  const parsed = presenceSnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return;

  // Al cambiar de workspace llega el snapshot del anterior con retraso. Si se
  // aceptara, el conteo mostraría gente del workspace que ya no estás viendo.
  if (!currentWorkspaceId || parsed.data.workspaceId !== currentWorkspaceId) {
    return;
  }

  usePresenceStore.getState().setSnapshot(parsed.data);
}

export { PRESENCE_SNAPSHOT_EVENT };
