import type { SystemRole, User } from "@taskmaster/contracts";
import { http } from "@/services/http";

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: SystemRole;
  isEmailVerified: boolean;
  createdAt: string;
}

export const ADMIN_PAGE_SIZE = 20;

export const adminApi = {
  listUsers: (page: number, pageSize: number) =>
    http.get<{ items: AdminUserRow[]; total: number }>(
      `/admin/users?page=${page}&pageSize=${pageSize}`,
    ),
  updateRole: (userId: string, role: SystemRole) =>
    http.patch<User>(`/admin/users/${userId}/role`, { role }),
};
