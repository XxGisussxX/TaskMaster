import type { WorkspaceMember } from "@prisma/client";
import type { User } from "@taskmaster/contracts";

export interface WorkspaceMemberWithUser extends WorkspaceMember {
  user?: Pick<User, "id" | "name" | "email" | "avatarUrl">;
}
