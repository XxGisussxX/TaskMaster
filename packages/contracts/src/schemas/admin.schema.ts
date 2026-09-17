import { z } from "zod";
import { SystemRole } from "../enums";

export const updateSystemRoleSchema = z.object({
  role: z.nativeEnum(SystemRole),
});

export const adminUserIdParamsSchema = z.object({
  id: z.string().min(1, "User ID inválido"),
});

export type UpdateSystemRoleInput = z.infer<typeof updateSystemRoleSchema>;
