import { z } from "zod";

/**
 * Estado de presencia de un workspace.
 *
 * Viaja por el socket, no por REST: es efímero y se recalcula en memoria, así
 * que guardarlo en base solo produciría filas basura que hay que purgar.
 */
export const presenceSnapshotSchema = z
  .object({
    workspaceId: z.string().min(1),
    /** Ids de usuarios con al menos un socket vivo, sin duplicados. */
    activeUserIds: z.array(z.string().min(1)),
    activeCount: z.number().int().nonnegative(),
    generatedAt: z.string(),
  })
  .refine((s) => s.activeCount === s.activeUserIds.length, {
    // El contador es una comodidad para la UI. Si no calza con la lista, uno de
    // los dos está mal y mostrar cualquiera de los dos sería mentir: mejor
    // rechazar el snapshot entero que pintar un número que no corresponde.
    message: "activeCount debe coincidir con la cantidad de usuarios activos",
    path: ["activeCount"],
  })
  .refine((s) => new Set(s.activeUserIds).size === s.activeUserIds.length, {
    message: "activeUserIds no debe contener duplicados",
    path: ["activeUserIds"],
  });

export type PresenceSnapshot = z.infer<typeof presenceSnapshotSchema>;

/** Evento con el que el cliente mantiene viva su presencia. */
export const PRESENCE_HEARTBEAT_EVENT = "presence:heartbeat";
/** Evento con el que el servidor difunde el estado actual del workspace. */
export const PRESENCE_SNAPSHOT_EVENT = "presence:snapshot";
