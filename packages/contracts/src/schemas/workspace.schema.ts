import { z } from "zod";
import { WorkspaceRole } from "../enums";

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug inválido: solo minúsculas, números y guiones")
    .optional(),
  icon: z.string().max(4).optional(),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.string().max(4).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email inválido"),
  role: z.nativeEnum(WorkspaceRole),
});

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(WorkspaceRole),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token requerido"),
});

export const inviteTokenParamsSchema = z.object({
  token: z.string().min(1, "Token requerido"),
});

export const inviteIdParamsSchema = z.object({
  id: z.string().min(1, "Invite ID inválido"),
});

export const invitePreviewSchema = z.object({
  workspaceName: z.string(),
  inviterName: z.string(),
  email: z.string().email("Email inválido"),
  role: z.nativeEnum(WorkspaceRole),
  expiresAt: z.string().datetime(),
  accepted: z.boolean(),
});

export const updateWorkspaceBySlugSchema = updateWorkspaceSchema;

export const workspaceIdParamsSchema = z.object({
  id: z.string().min(1, "Workspace ID inválido"),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type InvitePreview = z.infer<typeof invitePreviewSchema>;
