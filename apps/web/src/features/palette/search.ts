import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/features/tasks/api/tasks.api";
import { notesApi } from "@/features/notes/api/notes.api";
import { useCurrentWorkspaceId } from "@/features/tasks/hooks/useTasks";
import { useDebounce } from "@/hooks/useDebounce";

const MIN_QUERY_LENGTH = 2;
const SEARCH_PAGE_SIZE = 5;

/** Búsqueda de contenido (tareas + notas) para la paleta, con debounce. */
export function usePaletteSearch(rawQuery: string) {
  const workspaceId = useCurrentWorkspaceId();
  const query = useDebounce(rawQuery.trim(), 250);
  const hasQuery = query.length >= MIN_QUERY_LENGTH;
  const enabled = !!workspaceId && hasQuery;

  const tasks = useQuery({
    queryKey: ["palette-tasks", workspaceId, query],
    queryFn: () =>
      tasksApi.list(workspaceId!, {
        search: query,
        pageSize: SEARCH_PAGE_SIZE,
      }),
    enabled,
  });

  const notes = useQuery({
    queryKey: ["palette-notes", workspaceId, query],
    queryFn: () =>
      notesApi.list(workspaceId!, {
        search: query,
        pageSize: SEARCH_PAGE_SIZE,
      }),
    enabled,
  });

  return {
    hasQuery,
    searching: enabled && (tasks.isFetching || notes.isFetching),
    tasks: tasks.data?.items ?? [],
    notes: notes.data?.items ?? [],
  };
}
