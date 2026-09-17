import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SystemRole } from "@taskmaster/contracts";
import { toast } from "sonner";
import { adminApi } from "../api/admin.api";

export function useAdminUsers(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["admin-users", page, pageSize],
    queryFn: () => adminApi.listUsers(page, pageSize),
  });
}

export function useUpdateSystemRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: SystemRole }) =>
      adminApi.updateRole(userId, role),
    onSuccess: () => {
      toast.success("Rol de plataforma actualizado");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast.error("No se pudo actualizar el rol", {
        description: error.message,
      });
    },
  });
}
