import { useTasks } from "@/features/tasks/hooks/useTasks";
import { useNotes } from "@/features/notes/hooks/useNotes";
import { useDebounce } from "@/hooks/useDebounce";

const MIN_QUERY_LENGTH = 2;
const SEARCH_PAGE_SIZE = 5;

/**
 * Búsqueda de contenido (tareas + notas) para la paleta, con debounce.
 *
 * Usa los hooks `useTasks`/`useNotes` en vez de `useQuery` sueltos: así comparte
 * la query key canónica (`["tasks"|"notes", workspaceId, …]`) con las páginas, y
 * una invalidación por crear/editar una nota o tarea refresca también la paleta
 * (antes vivía en `["palette-notes", …]` y quedaba desactualizada).
 */
export function usePaletteSearch(rawQuery: string) {
  const query = useDebounce(rawQuery.trim(), 250);
  const hasQuery = query.length >= MIN_QUERY_LENGTH;

  const tasks = useTasks(
    { search: query, pageSize: SEARCH_PAGE_SIZE },
    hasQuery,
  );

  const notes = useNotes(
    { search: query, pageSize: SEARCH_PAGE_SIZE },
    hasQuery,
  );

  return {
    hasQuery,
    searching: hasQuery && (tasks.isFetching || notes.isFetching),
    tasks: tasks.data?.items ?? [],
    notes: notes.data?.items ?? [],
  };
}
