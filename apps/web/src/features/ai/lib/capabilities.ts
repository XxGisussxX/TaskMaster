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
 * este gate viene a cerrar. Pero ese fallo **no** se cachea (ver abajo): si el
 * backend estaba caído al primer montaje, cachearlo dejaba la UI sin asistente
 * durante toda la sesión.
 */
const NO_AI: AiCapabilities = {
  configured: false,
  model: "",
  dailyLimit: 0,
};

/**
 * TTL del acierto. Las capabilities son configuración del servidor y no cambian
 * en caliente, pero tampoco son eternas: vencer la entrada permite que una key
 * agregada sin reiniciar el frontend termine apareciendo, sin volver al tráfico
 * por montaje que este caché vino a evitar.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  promise: Promise<AiCapabilities>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function loadAiCapabilities(
  workspaceId: string,
): Promise<AiCapabilities> {
  const now = Date.now();
  const cached = cache.get(workspaceId);
  if (cached && cached.expiresAt > now) return cached.promise;

  const entry = {} as CacheEntry;
  const promise = aiApi.getCapabilities(workspaceId).catch(() => {
    // La promesa rechazada se saca del caché para que el próximo montaje
    // reintente en vez de heredar el NO_AI por el resto de la sesión.
    if (cache.get(workspaceId) === entry) cache.delete(workspaceId);
    return NO_AI;
  });
  entry.promise = promise;
  entry.expiresAt = now + CACHE_TTL_MS;
  cache.set(workspaceId, entry);

  return promise;
}

/** Descarta la cache. Solo para tests: en producción no hay motivo. */
export function resetAiCapabilitiesCache(): void {
  cache.clear();
}
