import { z } from "zod";
import { namedIdSchema } from "./common.schema";

export const createChannelSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(40),
  color: z.string().max(20).nullable().optional(),
});

export const updateChannelSchema = createChannelSchema.partial();

export const channelIdParamsSchema = z.object({
  id: namedIdSchema("ID de canal inválido"),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
