import type { AiCapabilities } from "@taskmaster/contracts";
import { aiApi } from "../api/ai.api";

/**
 * Cache de capacidades por sesión de la app.
 *
 * Vive acá y no dentro de un componente por dos razones. La primera es que lo
 * consultan superficies distintas (el orbe del asistente y la tarjeta de
 * agenda), así que un caché colgado de un componente solo taparía a la otra. La
 * segunda es que la respuesta es credenciales del servidor: no cambia durante la
 * vida del proceso, y pegarle `/ai/capabilities` en cada montaje convertía un
 * detalle de configuración en tráfico por navegación.
 *
 * La clave es el workspace y no una sola promesa global porque el endpoint exige
 * membresía: cachear un único resultado haría que al cambiar de workspace la UI
 * mostrara el estado de uno al que ya no pertenece.
 *
 * Ante un fallo se devuelve el estado más conservador en vez de propagar el
 * error: si no sabemos si hay IA, mostramos el aviso de "no configurada". Al revés
 * —asumir que sí y esperar un 503 en cada mensaje— era exactamente el bug que
 * este gate viene a cerrar.
 */
const NO_AI: AiCapabilities = {
  configured: false,
  model: "",
  dailyLimit: 0,
};

const inFlight = new Map<string, Promise<AiCapabilities>>();

export function loadAiCapabilities(
  workspaceId: string,
): Promise<AiCapabilities> {
  let pending = inFlight.get(workspaceId);
  if (!pending) {
    pending = aiApi.getCapabilities(workspaceId).catch(() => NO_AI);
    inFlight.set(workspaceId, pending);
  }
  return pending;
}

/** Descarta la cache. Solo para tests: en producción no hay motivo. */
export function resetAiCapabilitiesCache(): void {
  inFlight.clear();
}
