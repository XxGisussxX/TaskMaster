import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usersApi } from "../api/users.api";
import { changePassword } from "@/features/auth/api/auth.api";
import { useAuthStore } from "@/store/auth.store";

export function useProfile() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => usersApi.getProfile(),
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  return useMutation({
    mutationFn: (input: { name?: string; avatarUrl?: string | null }) =>
      usersApi.updateProfile(input),
    onSuccess: (updatedUser) => {
      if (accessToken && refreshToken) {
        setSession({
          user: updatedUser,
          accessToken,
          refreshToken,
        });
      }
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil actualizado");
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el perfil", {
        description: error.message,
      });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      changePassword(input),
    onSuccess: () => {
      toast.success("Contraseña cambiada. Por favor, inicia sesión de nuevo.");
    },
    onError: (error: Error) => {
      toast.error("No se pudo cambiar la contraseña", {
        description: error.message,
      });
    },
  });
}
