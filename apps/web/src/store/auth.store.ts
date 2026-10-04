import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSessionResponse, User } from "@taskmaster/contracts";

/**
 * `unknown` es el estado inicial y solo dura lo que tarda la rehidratación y el
 * bootstrap. Las rutas esperan a que se resuelva antes de decidir, para no
 * renderizar el shell de la app sobre una sesión que en realidad no existe.
 */
export type SessionStatus =
  "unknown" | "checking" | "authenticated" | "anonymous";

/**
 * Lo mínimo para dejar al cliente con una sesión válida. `expiresIn` no entra:
 * solo importa para mostrar cuánto dura el access token, y no se persiste
 * (`partialize` lo deja afuera) porque el bootstrap decide renovarlo leyendo el
 * `exp` del propio token.
 */
export type SessionPayload = Pick<AuthSessionResponse, "user" | "accessToken">;

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: SessionStatus;
  isHydrated: boolean;
  getAccessToken: () => string | null;
  /**
   * Hay un usuario y un access token en memoria. NO implica que la cookie de
   * refresh siga viva: esa vive en una cookie HttpOnly que el JavaScript de la
   * página no puede leer, así que su existencia solo se puede averiguar
   * preguntándole al servidor. Por eso `useSessionBootstrap` la valida una vez
   * al arrancar, y recién ahí `status` pasa a `"authenticated"`.
   */
  hasSession: () => boolean;
  setSession: (session: SessionPayload) => void;
  setUser: (user: User) => void;
  beginCheck: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      status: "unknown",
      isHydrated: false,
      getAccessToken: () => get().accessToken,
      hasSession: () => get().user !== null && get().accessToken !== null,
      setSession: (session) =>
        set({
          user: session.user,
          accessToken: session.accessToken,
          status: "authenticated",
        }),
      setUser: (user) => set({ user }),
      beginCheck: () => set({ status: "checking" }),
      clear: () => set({ user: null, accessToken: null, status: "anonymous" }),
    }),
    {
      name: "taskmaster.auth",
      version: 1,
      // El store antes persistía el refresh token. Ese valor ya no sirve: la
      // cookie HttpOnly se emite en el login y no se puede reconstruir desde
      // localStorage. Se descarta en vez de dejarlo ahí expuesto, y el usuario
      // tiene que volver a iniciar sesión una vez (el access token persistido
      // sigue sirviendo hasta que expire).
      migrate: (persisted) => {
        const state = persisted as {
          user?: User | null;
          accessToken?: string | null;
        };
        return {
          user: state.user ?? null,
          accessToken: state.accessToken ?? null,
        };
      },
      // `status` e `isHydrated` quedan fuera a propósito: se reconstruyen en
      // memoria, nunca se restauran. Si `status` se persistiera, una pestaña
      // nueva abriría creyendo que la sesión ya fue validada.
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ isHydrated: true });
      },
    },
  ),
);
