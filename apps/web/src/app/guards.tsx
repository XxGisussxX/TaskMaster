import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { SystemRole } from "@taskmaster/contracts";
import { useAuthStore } from "@/store/auth.store";

/**
 * Nada de rutas hasta que la sesión persistida esté resuelta. `status` es
 * `"unknown"` durante la rehidratación y el arranque, y `"checking"` mientras
 * se valida la cookie de refresh; renderizar antes de eso dibujaría el shell de
 * la app sobre una sesión que puede no existir.
 */
export function useResolvedSession() {
  const status = useAuthStore((s) => s.status);
  return status !== "unknown" && status !== "checking";
}

export function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const resolved = useResolvedSession();
  const location = useLocation();

  if (!resolved) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Restringe las rutas hijas a roles de plataforma (USER/ADMIN/SUPER_ADMIN). */
export function RequireSystemRole({ roles }: { roles: SystemRole[] }) {
  const user = useAuthStore((s) => s.user);
  const resolved = useResolvedSession();

  if (!resolved) return null;

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const user = useAuthStore((s) => s.user);
  const resolved = useResolvedSession();

  if (!resolved) return null;

  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
