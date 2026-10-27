import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  usersApi,
  type UpdateUserSettingsInput,
  type UserSettings,
} from "../api/users.api";
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
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (input: { name?: string; avatarUrl?: string | null }) =>
      usersApi.updateProfile(input),
    onSuccess: (updatedUser) => {
      // Antes había que rearmar la sesión entera para no perder el refresh
      // token que venía en el store. Ahora solo se actualiza el user.
      setUser(updatedUser);
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

export function useUserSettings() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ["user-settings"],
    queryFn: () => usersApi.getSettings(),
    enabled: !!user,
  });
}

export function useUpdateUserSettings() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateUserSettingsInput) =>
      usersApi.updateSettings(input),
    onSuccess: (settings) => {
      qc.setQueryData<UserSettings>(["user-settings"], settings);
    },
    onError: (error: Error) => {
      toast.error("No se pudieron guardar las preferencias", {
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
