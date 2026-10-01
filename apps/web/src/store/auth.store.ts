import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthSessionResponse, User } from "@taskmaster/contracts";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isHydrated: boolean;
  getAccessToken: () => string | null;
  /**
   * El refresh token no está en el store: vive en una cookie HttpOnly que el
   * JavaScript de la página no puede leer. Por eso esto no puede significar
   * "hay un refresh token guardado" sino "hay una sesión en curso", que es lo
   * que el cliente necesita para decidir si intentar renovar el access token.
   */
  hasSession: () => boolean;
  setSession: (session: AuthSessionResponse) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isHydrated: false,
      getAccessToken: () => get().accessToken,
      hasSession: () => get().user !== null,
      setSession: (session) =>
        set({
          user: session.user,
          accessToken: session.accessToken,
        }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null }),
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
