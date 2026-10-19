import type {
  AssignPermissionGroupMembersInput,
  CreatePermissionGroupInput,
  CreateTeamInput,
  PermissionGroupWithMembers,
  TeamWithMembers,
  UpdatePermissionGroupInput,
  UpdateTeamInput,
} from "@taskmaster/contracts";
import { http } from "@/services/http";

export const teamsApi = {
  list: (workspaceId: string) =>
    http.get<TeamWithMembers[]>(`/workspaces/${workspaceId}/teams`),
  create: (workspaceId: string, input: CreateTeamInput) =>
    http.post<TeamWithMembers>(`/workspaces/${workspaceId}/teams`, input),
  update: (workspaceId: string, teamId: string, input: UpdateTeamInput) =>
    http.patch<TeamWithMembers>(
      `/workspaces/${workspaceId}/teams/${teamId}`,
      input,
    ),
  remove: (workspaceId: string, teamId: string) =>
    http.delete<void>(`/workspaces/${workspaceId}/teams/${teamId}`),
  assignMembers: (workspaceId: string, teamId: string, memberIds: string[]) =>
    http.post<TeamWithMembers>(
      `/workspaces/${workspaceId}/teams/${teamId}/members`,
      {
        memberIds,
      },
    ),
};

export const permissionGroupsApi = {
  list: (workspaceId: string) =>
    http.get<PermissionGroupWithMembers[]>(
      `/workspaces/${workspaceId}/permission-groups`,
    ),
  create: (workspaceId: string, input: CreatePermissionGroupInput) =>
    http.post<PermissionGroupWithMembers>(
      `/workspaces/${workspaceId}/permission-groups`,
      input,
    ),
  update: (
    workspaceId: string,
    groupId: string,
    input: UpdatePermissionGroupInput,
  ) =>
    http.patch<PermissionGroupWithMembers>(
      `/workspaces/${workspaceId}/permission-groups/${groupId}`,
      input,
    ),
  remove: (workspaceId: string, groupId: string) =>
    http.delete<void>(
      `/workspaces/${workspaceId}/permission-groups/${groupId}`,
    ),
  assignMembers: (
    workspaceId: string,
    groupId: string,
    input: AssignPermissionGroupMembersInput,
  ) =>
    http.post<PermissionGroupWithMembers>(
      `/workspaces/${workspaceId}/permission-groups/${groupId}/members`,
      input,
    ),
};
