import { z } from "zod";

export const markAllReadSchema = z.object({});
export const notificationFiltersSchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type NotificationFilters = z.infer<typeof notificationFiltersSchema>;
