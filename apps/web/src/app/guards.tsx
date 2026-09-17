import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { SystemRole } from "@taskmaster/contracts";
import { useAuthStore } from "@/store/auth.store";

export function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const location = useLocation();

  if (!isHydrated) return null;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Restringe las rutas hijas a roles de plataforma (USER/ADMIN/SUPER_ADMIN). */
export function RequireSystemRole({ roles }: { roles: SystemRole[] }) {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) return null;

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

export function RedirectIfAuthed() {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  if (!isHydrated) return null;

  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
