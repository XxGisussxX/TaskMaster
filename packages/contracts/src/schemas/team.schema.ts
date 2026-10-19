import { z } from "zod";
import { namedIdSchema } from "./common.schema";

export const teamSchema = z.object({
  id: namedIdSchema("ID de equipo inválido"),
  workspaceId: namedIdSchema("ID de workspace inválido"),
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(500).default(""),
  color: z.string().trim().min(1).max(20).default("#3b82f6"),
  avatar: z.string().trim().max(10).optional().nullable(),
});

export type Team = z.infer<typeof teamSchema>;

export const createTeamSchema = teamSchema
  .pick({
    name: true,
    description: true,
    color: true,
    avatar: true,
  })
  .strict();

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial().strict();

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export const teamIdParamsSchema = z.object({
  teamId: namedIdSchema("ID de equipo inválido"),
});

export const assignTeamMembersSchema = z.object({
  memberIds: z.array(namedIdSchema("ID de miembro inválido")).min(1).max(100),
});

export type AssignTeamMembersInput = z.infer<typeof assignTeamMembersSchema>;

/** Miembro resumido dentro de un equipo. */
export const teamMemberSummarySchema = z.object({
  memberId: namedIdSchema("ID de miembro inválido"),
  userId: namedIdSchema("ID de usuario inválido"),
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable().optional(),
});

export type TeamMemberSummary = z.infer<typeof teamMemberSummarySchema>;

export const teamWithMembersSchema = teamSchema.extend({
  members: z.array(teamMemberSummarySchema).default([]),
});

export type TeamWithMembers = z.infer<typeof teamWithMembersSchema>;
