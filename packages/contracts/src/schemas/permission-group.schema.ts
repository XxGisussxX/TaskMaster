import { z } from "zod";
import { WorkspaceRole } from "../enums";
import { namedIdSchema } from "./common.schema";

const workspaceRoleSchema = z.nativeEnum(WorkspaceRole);

export const permissionGroupSchema = z.object({
  id: namedIdSchema("ID de grupo inválido"),
  workspaceId: namedIdSchema("ID de workspace inválido"),
  name: z.string().trim().min(2, "El nombre es muy corto").max(50),
  description: z.string().trim().max(500).default(""),
  color: z.string().trim().min(1).max(20).default("#6366f1"),
  role: workspaceRoleSchema.default(WorkspaceRole.MEMBER),
});

export type PermissionGroup = z.infer<typeof permissionGroupSchema>;

export const createPermissionGroupSchema = permissionGroupSchema
  .pick({ name: true, description: true, color: true, role: true })
  .strict();

export type CreatePermissionGroupInput = z.infer<
  typeof createPermissionGroupSchema
>;

export const updatePermissionGroupSchema = createPermissionGroupSchema
  .partial()
  .strict();

export type UpdatePermissionGroupInput = z.infer<
  typeof updatePermissionGroupSchema
>;

export const permissionGroupIdParamsSchema = z.object({
  groupId: namedIdSchema("ID de grupo inválido"),
});

export const assignPermissionGroupMembersSchema = z.object({
  memberIds: z.array(namedIdSchema("ID de miembro inválido")).max(200),
});

export type AssignPermissionGroupMembersInput = z.infer<
  typeof assignPermissionGroupMembersSchema
>;

/** Miembro resumido dentro de un grupo de permisos. */
export const permissionGroupMemberSchema = z.object({
  memberId: namedIdSchema("ID de miembro inválido"),
  userId: namedIdSchema("ID de usuario inválido"),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
  workspaceRole: workspaceRoleSchema,
});

export type PermissionGroupMember = z.infer<typeof permissionGroupMemberSchema>;

export const permissionGroupWithMembersSchema = permissionGroupSchema.extend({
  members: z.array(permissionGroupMemberSchema).default([]),
});

export type PermissionGroupWithMembers = z.infer<
  typeof permissionGroupWithMembersSchema
>;
