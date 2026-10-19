# Follow-ups (issues pendientes)

Hallazgos de la revisión de producto (Parte 1 y Parte 2) que **no** se tocaron
en este PR. Cada entrada tiene severidad (Alta/Media/Baja), la ubicación
`archivo:línea` que lo prueba y un esfuerzo estimado (S/M/L/XL). Nada de esto
está implementado; es una lista de deuda técnica para priorizar.

> Lo que ya se arregló en este PR no aparece como issue:
>
> - DreamBoard: `updatePin` ya **no** anula `imageUrl`/`sticker`/`linkedTaskId`
>   al arrastrar (`undefined` = no tocar, `null`/`""` = borrar), `PATCH {}` da 400
>   y `DreamBoard.updatedAt` se marca al crear/mover/borrar pins.
> - Gemini: la api key ya viaja por cabecera `x-goog-api-key`, no en la URL.
> - IA (I1/I3/I8): la cuota diaria ahora vive en Redis (con fallback en memoria
>   por proceso, vía `RedisService.withFallback`), el límite de la IA se aplica
>   por `usuario:workspace` y no por IP, y las lecturas del asistente están
>   acotadas (`take` por vencimiento en tareas, tope de tags/canales).
> - Notas (N1/N6): el filtro de notas ahora funciona y es por **nombre** de tag
>   (las tags de notas son filas `NoteTag` por nota, un `id` solo podía matchear
>   una nota), y `update` aplica diffs sobre tags/items/collaborators en vez de
>   borrarlos y recrearlos (menos escrituras, sin pisar cambios concurrentes).
> - DreamBoard (D4/D5/D6): crear el tablero tolera la carrera (`P2002` → relee
>   en vez de fallar), el `linkedTaskId` del update ya no exige formato cuid
>   (coherente con el create) y las coordenadas están acotadas al corcho.
>
> Resueltos después (fases de endurecimiento F2–F4):
>
> - Notas: N2 (paginación en la UI) y N7 (tiempo real por socket) están hechos.
> - DreamBoard: D2 (índice `(boardId, createdAt)`) y D7 (`title` editable con
>   endpoint `PATCH` y selector de tareas sin tope de página) están hechos. El
>   `removePin` ahora destruye el asset de Cloudinary (parte de D3).
> - IA: I4 (redacción de PII antes de enviar a Gemini), I5 (persistencia del chat
>   en `AiChatEntry`) e I6 (caché de capacidades con TTL de 5 min) están hechos.
> - Permisos: grupos de permisos (`PermissionGroup`) y UI de equipos, con rol
>   efectivo = máximo del rol propio y los roles de sus grupos.
>
> Resueltos después (fase de pendientes, sobre este PR):
>
> - IA: I2 (cuota diaria por `usuario:workspace`, y `/usage` filtra por
>   `workspaceId`) e I10 (hay `Logger`: cada generación y cada intent determinístico
>   dejan una línea operativa) están hechos.
> - Escalabilidad: T1 (`/dashboard` agrega en SQL con `$queryRaw`, sin materializar
>   las tareas), T2 (el heatmap anual se computa en el backend y el front lo usa),
>   T3 (`agenda-review` con tope `MAX_AGENDA_TASKS` y `truncated`), T4 (time-entries
>   con paginación, rango acotado e índice `[workspaceId, startedAt]`) y T5 (índices
>   `[workspaceId, completedAt]` / `[workspaceId, createdAt]`) están hechos.

## Notas

| #   | Hallazgo                                                                                            | Severidad | Ubicación                                                                                                               | Esfuerzo |
| --- | --------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| N3  | Búsqueda sin debounce: una request por tecla (`query key` reconstruida en cada keystroke)           | Baja      | `apps/web/src/features/notes/pages/NotesPage.tsx:105-109` · `hooks/useNotes.ts:11`                                      | S        |
| N4  | Endpoints de pin/unpin y checklist sin uso: la UI hace pin vía `update` y no tiene editor de items  | Media     | `apps/api/src/modules/notes/notes.controller.ts:85-148` · `apps/web/.../NoteForm.tsx` (sin editor) · `NotesPage.tsx:54` | M        |
| N5  | Límite de contenido divergente: el form permite 20 000 chars, el servidor rechaza >10 000           | Baja      | `apps/web/.../NoteForm.tsx:18` · `note.schema.ts:15`                                                                    | S        |
| N8  | Modo local (workspace demo) guarda HTML sin sanitizar y no respeta orden por pinned                 | Media     | `apps/web/.../localNotes.ts:128-129,92-95`                                                                              | S        |
| N9  | Asimetría de sanitización cliente vs servidor (href relativos `libre/`/`#` y tags `label/div/span`) | Baja      | `apps/web/src/components/ui/rich-text.tsx:61-71` · `apps/api/src/common/sanitize/html.ts:66`                            | S        |
| N10 | Fetch duplicado de notas desde la paleta (query key distinta, `["palette-notes", ...]`)             | Baja      | `apps/web/src/features/palette/search.ts:27-35`                                                                         | S        |

## DreamBoard

| #   | Hallazgo                                                                                                                                                                                                   | Severidad | Ubicación                                                                                                                 | Esfuerzo |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | Drag & drop sin debounce/throttle: 1 `PATCH` por `dragstop` + refetch completo del board                                                                                                                   | Media     | `apps/web/src/features/dream-board/pages/DreamBoardPage.tsx:58-63` · `hooks/useDreamBoard.ts:40-41`                       | S        |
| D3  | Imágenes huérfanas: los pins guardan solo la `url` de Cloudinary (sin `publicId`), así que el borrado del asset depende de derivar el `publicId` desde la URL; sin Cloudinary cae a `data:` base64 gigante | Media     | `apps/api/src/modules/dream-board/dream-board.service.ts` · `apps/api/src/modules/uploads/uploads.service.ts:227,232-234` | M        |

## IA

| #   | Hallazgo                                                             | Severidad | Ubicación                                                                                               | Esfuerzo |
| --- | -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- | -------- |
| I9  | Sin streaming: POST bloqueante (hasta 30 s) con typewriter cosmético | Media     | `apps/api/src/modules/ai/gemini.provider.ts:61-133` · `apps/web/src/features/ai/hooks/useTypewriter.ts` | L        |

## Dashboard / time-entries / agenda

| #   | Hallazgo                                                                                                           | Severidad | Ubicación                                                                                                                      | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| T6  | `useDashboardStats` montado en 5 componentes distintos (misma query key); cualquier invalidación refetchea a todos | Baja      | `apps/web/.../DashboardPage.tsx:46` · `WorkspacePage.tsx:56` · `ActivityTab.tsx:8` · `SidePanel.tsx:92` · `AiAssistant.tsx:92` | S        |
