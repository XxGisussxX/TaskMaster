import type { AuthSessionResponse, User } from "@taskmaster/contracts";
import { ApiError } from "./api-error";
import { useAuthStore, type SessionPayload } from "@/store/auth.store";

const REFRESH_URL = "/api/auth/refresh";
const STORAGE_KEY = "taskmaster.auth";
const LOCK_KEY = "taskmaster.auth.refresh.lock";

/**
 * Margen de vida del lock. Si una pestaña que lo tomó se cierra a mitad de la
 * rotación, el lock se vence solo y otra puede tomar el control.
 */
const LOCK_TTL_MS = 15_000;
const POLL_INTERVAL_MS = 60;

interface LockRecord {
  id: string;
  expiresAt: number;
}

type PeerOutcome =
  { kind: "token"; token: string } | { kind: "ended" } | { kind: "timeout" };

let inflight: Promise<string> | null = null;

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** La sesión tal como la persistió `zustand/persist`, leída del storage. */
function readPersistedSession(): SessionPayload | null {
  const parsed = readJson<{
    state?: { user?: User | null; accessToken?: string | null };
  }>(localStorage.getItem(STORAGE_KEY));
  const user = parsed?.state?.user;
  const accessToken = parsed?.state?.accessToken;
  return user && accessToken ? { user, accessToken } : null;
}

function readLock(): LockRecord | null {
  return readJson<LockRecord>(localStorage.getItem(LOCK_KEY));
}

function acquireLock(): string | null {
  const id = randomId();
  const record: LockRecord = { id, expiresAt: Date.now() + LOCK_TTL_MS };
  localStorage.setItem(LOCK_KEY, JSON.stringify(record));
  // Última escritura gana: si otra pestaña intentó tomar el lock en el mismo
  // tick, solo una queda con el id que terminó escrito.
  return readLock()?.id === id ? id : null;
}

function releaseLock(id: string): void {
  if (readLock()?.id === id) localStorage.removeItem(LOCK_KEY);
}

/** Un solo `fetch` a `/auth/refresh`; el store queda consistente pase lo que pase. */
async function rotate(): Promise<string> {
  const res = await fetch(REFRESH_URL, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    useAuthStore.getState().clear();
    throw new ApiError(401, "Sesión expirada");
  }

  const session = (await res.json()) as AuthSessionResponse;
  useAuthStore.getState().setSession(session);
  return session.accessToken;
}

/**
 * Espera a que la pestaña que tomó el lock termine de rotar.
 *
 * `setSession` escribe el access token nuevo en `taskmaster.auth`, lo que
 * dispara un evento `storage` en el resto de las pestañas: eso es lo que esta
 * función espera, en vez de pegarle de nuevo a `/auth/refresh` y perder la
 * rotación por el camino.
 */
function waitForPeer(
  lock: LockRecord,
  baseline: string | null,
): Promise<PeerOutcome> {
  return new Promise((resolve) => {
    let settled = false;

    const check = () => {
      const current = readPersistedSession();
      if (current && current.accessToken !== baseline) {
        useAuthStore.getState().setSession(current);
        finish({ kind: "token", token: current.accessToken });
        return;
      }
      // La otra pestaña cerró sesión o su refresh falló: ya no hay nada que
      // adoptar y esta tampoco puede seguir.
      if (!current && localStorage.getItem(STORAGE_KEY) !== null) {
        finish({ kind: "ended" });
        return;
      }
      if (Date.now() >= lock.expiresAt) finish({ kind: "timeout" });
    };

    function onStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY) check();
    }

    function finish(outcome: PeerOutcome) {
      // `check` puede disparar por `storage` y por el intervalo en el mismo
      // tick; el primer resultado gana.
      if (settled) return;
      settled = true;
      window.removeEventListener("storage", onStorage);
      clearInterval(poll);
      clearTimeout(deadline);
      resolve(outcome);
    }

    const poll = setInterval(check, POLL_INTERVAL_MS);
    const deadline = setTimeout(
      () => finish({ kind: "timeout" }),
      LOCK_TTL_MS + 1_000,
    );
    window.addEventListener("storage", onStorage);
  });
}

/**
 * Serializa la rotación entre pestañas.
 *
 * La rotación del servidor es de un solo uso: `AuthService.rotateRefreshToken`
 * revoca el token presentado con un `updateMany` atómico y el que llega segundo
 * recibe un 401 aunque su sesión sea perfectamente válida. Y la cookie
 * `tm_refresh` es host-only (`auth-cookie.ts` no setea `domain`), así que todas
 * las pestañas del navegador comparten el mismo token: sin este lock, abrir dos
 * pestañas y que ambas caduquen al mismo tiempo es suficiente para que una quede
 * deslogueada.
 */
async function rotateCoordinated(): Promise<string> {
  const baseline = useAuthStore.getState().getAccessToken();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const lock = readLock();
    if (lock && lock.expiresAt > Date.now()) {
      const outcome = await waitForPeer(lock, baseline);
      if (outcome.kind === "token") return outcome.token;
      if (outcome.kind === "ended") {
        useAuthStore.getState().clear();
        throw new ApiError(401, "Sesión expirada");
      }
      // El lock se venció sin que nadie publicara nada: ahora nos toca a
      // nosotros, y el `continue` vuelve a evaluarlo ya vencido.
      continue;
    }

    const lockId = acquireLock();
    // Otra pestaña ganó la carrera por el lock entre la lectura y la escritura.
    if (!lockId) continue;

    try {
      return await rotate();
    } finally {
      releaseLock(lockId);
    }
  }

  return rotate();
}

/**
 * Rota la cookie de refresh y devuelve un access token válido.
 *
 * Una sola rotación a la vez por pestaña, y una sola a la vez entre pestañas.
 * Rechaza con `ApiError(401)` si la sesión no se puede renovar; en ese caso la
 * sesión ya quedó limpiada.
 */
export function refreshAccessToken(): Promise<string> {
  inflight ??= rotateCoordinated().finally(() => {
    inflight = null;
  });
  return inflight;
}
