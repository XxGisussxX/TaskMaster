import { useMemo } from "react";
import { useMembers } from "@/features/workspace/hooks/useMembers";

export function useMentionSearch(query: string) {
  const { data: members = [] } = useMembers();

  return useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    return members
      .filter(
        (m) =>
          m.user?.name?.toLowerCase().includes(q) ||
          m.user?.email?.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((m) => ({
        id: m.userId,
        name: m.user?.name ?? "Usuario",
        email: m.user?.email ?? "",
        avatarUrl: m.user?.avatarUrl ?? null,
      }));
  }, [query, members]);
}
