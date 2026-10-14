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

## Notas

| #   | Hallazgo                                                                                                                       | Severidad | Ubicación                                                                                                               | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| N1  | Filtro `tagId` aceptado por el schema pero ignorado por el servicio                                                            | Media     | `packages/contracts/src/schemas/note.schema.ts:40` · `apps/api/src/modules/notes/notes.service.ts:56-64`                | S        |
| N2  | La UI no pagina: el front solo lee la primera página (`pageSize` 24); notas >24 inalcanzables                                  | Media     | `apps/web/src/features/notes/pages/NotesPage.tsx:44,150-167`                                                            | S        |
| N3  | Búsqueda sin debounce: una request por tecla (`query key` reconstruida en cada keystroke)                                      | Baja      | `apps/web/src/features/notes/pages/NotesPage.tsx:105-109` · `hooks/useNotes.ts:11`                                      | S        |
| N4  | Endpoints de pin/unpin y checklist sin uso: la UI hace pin vía `update` y no tiene editor de items                             | Media     | `apps/api/src/modules/notes/notes.controller.ts:85-148` · `apps/web/.../NoteForm.tsx` (sin editor) · `NotesPage.tsx:54` | M        |
| N5  | Límite de contenido divergente: el form permite 20 000 chars, el servidor rechaza >10 000                                      | Baja      | `apps/web/.../NoteForm.tsx:18` · `note.schema.ts:15`                                                                    | S        |
| N6  | `update` = delete+recreate de tags/items/collaborators: amplificación de escritura y pérdida en concurrencia                   | Media     | `apps/api/src/modules/notes/notes.service.ts:158-183`                                                                   | M        |
| N7  | Sin tiempo real en notas: no hay eventos socket de notas; `NoteCollaborator` no otorga permisos y `NOTE_SHARED` nunca se emite | Media     | `apps/api/src/modules/websocket/websocket.gateway.ts:197-258` · `packages/contracts/src/enums.ts:76`                    | L        |
| N8  | Modo local (workspace demo) guarda HTML sin sanitizar y no respeta orden por pinned                                            | Media     | `apps/web/.../localNotes.ts:128-129,92-95`                                                                              | S        |
| N9  | Asimetría de sanitización cliente vs servidor (href relativos `libre/`/`#` y tags `label/div/span`)                            | Baja      | `apps/web/src/components/ui/rich-text.tsx:61-71` · `apps/api/src/common/sanitize/html.ts:66`                            | S        |
| N10 | Fetch duplicado de notas desde la paleta (query key distinta, `["palette-notes", ...]`)                                        | Baja      | `apps/web/src/features/palette/search.ts:27-35`                                                                         | S        |

## DreamBoard

| #   | Hallazgo                                                                                                                                              | Severidad | Ubicación                                                                                                                     | Esfuerzo |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | Drag & drop sin debounce/throttle: 1 `PATCH` por `dragstop` + refetch completo del board                                                              | Media     | `apps/web/src/features/dream-board/pages/DreamBoardPage.tsx:58-63` · `hooks/useDreamBoard.ts:40-41`                           | S        |
| D2  | `getBoard` carga todos los pins sin límite; no existe índice compuesto `(boardId, createdAt)` para el `orderBy`                                       | Media     | `apps/api/src/modules/dream-board/dream-board.service.ts:32-43` · `apps/api/prisma/schema.prisma:703-706`                     | S        |
| D3  | Imágenes huérfanas: `removePin` no destruye el asset y los pins guardan solo `url` (sin `publicId`); fallback a `data:` base64 gigante sin Cloudinary | Media     | `apps/api/src/modules/dream-board/dream-board.service.ts:141` · `apps/api/src/modules/uploads/uploads.service.ts:227,232-234` | M        |
| D4  | TOCTOU en la creación del board: `ensureBoard` hace find-then-create sin transacción (P2002 posible) y `getBoard` falla idempotencia en concurrentes  | Baja      | `apps/api/src/modules/dream-board/dream-board.service.ts:32-56,186-193`                                                       | S        |
| D5  | `updateDreamPinSchema.linkedTaskId` exige `.cuid()` mientras el create usa `namedIdSchema`: pins del seed (ids legibles) no se pueden re-vincular     | Baja      | `packages/contracts/src/schemas/dream-board.schema.ts:72 (create) vs 104 (update)`                                            | S        |
| D6  | `positionSchema` sin límites: se pueden guardar coordenadas arbitrarias                                                                               | Baja      | `packages/contracts/src/schemas/dream-board.schema.ts:44`                                                                     | S        |
| D7  | `DreamBoard.title` inerte (sin endpoint/UI) y el selector de tarea limitado a la 1ª página (`pageSize` 20)                                            | Baja      | `apps/api/prisma/schema.prisma:669-678` · `apps/web/.../AddPinModal.tsx:41`                                                   | S        |

## IA

| #   | Hallazgo                                                                                                          | Severidad | Ubicación                                                                                               | Esfuerzo |
| --- | ----------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- | -------- |
| I2  | Cuota/uso por usuario, no por workspace: `getUsage` no filtra por `workspaceId` en un endpoint workspace-scoped   | Media     | `apps/api/src/modules/ai/ai.service.ts:366-383,429-445`                                                 | S        |
| I4  | PII a Google sin redactar: títulos/tags/channels y texto libre se envían al proveedor (key ya está en cabecera)   | Alta      | `apps/api/src/modules/ai/ai.service.ts:312-342,447-474`                                                 | M        |
| I5  | Chat sin persistencia: estado `useState` en el cliente, se pierde al recargar                                     | Media     | `apps/web/src/features/ai/hooks/useAiAssistant.ts:44-48,179-182`                                        | M        |
| I6  | Caché de capacidades nunca expira y cachea fallos `NO_AI` para toda la sesión                                     | Baja      | `apps/web/src/features/ai/lib/capabilities.ts:29-45`                                                    | S        |
| I7  | Documentación menciona `OPENAI_API_KEY`; la implementación es solo Gemini                                         | Baja      | `GUIA-DE-NAVEGACION-TASKMASTER.md:204`                                                                  | S        |
| I9  | Sin streaming: POST bloqueante (hasta 30 s) con typewriter cosmético                                              | Media     | `apps/api/src/modules/ai/gemini.provider.ts:61-133` · `apps/web/src/features/ai/hooks/useTypewriter.ts` | L        |
| I10 | Sin observabilidad: no hay `Logger`; solo la fila de `AiGeneration` (los intents determinísticos no loguean nada) | Baja      | `apps/api/src/modules/ai/ai.service.ts:496-521`                                                         | S        |

## Dashboard / time-entries / agenda

| #   | Hallazgo                                                                                                                       | Severidad | Ubicación                                                                                                                      | Esfuerzo |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| T1  | `/dashboard` carga todas las tareas no archivadas y computa KPIs/charts en memoria por request (sin `take` ni rango de fechas) | Alta      | `apps/api/src/modules/dashboard/dashboard.service.ts:28-41,67-87`                                                              | M        |
| T2  | Heatmap "anual" derivado de la serie de 30 días: `buildHeatmapData` existe pero no se usa                                      | Media     | `apps/web/src/features/dashboard/pages/DashboardPage.tsx:275-285` · `packages/domain/src/dashboard.ts:155-182`                 | S        |
| T3  | `agenda-review` sin cota: carga todas las tareas abiertas                                                                      | Media     | `apps/api/src/modules/agenda/agenda.service.ts:32-46`                                                                          | S        |
| T4  | `time-entries` sin paginación y sin índice por `startedAt` (`orderBy` sobre el set completo)                                   | Media     | `apps/api/src/modules/time-entries/time-entries.service.ts:89-95` · `apps/api/prisma/schema.prisma:625-626`                    | S        |
| T5  | Índices faltantes para los KPIs si se bajan a SQL: no hay `[workspaceId, completedAt]` ni `[workspaceId, createdAt]`           | Baja      | `apps/api/prisma/schema.prisma:339-343`                                                                                        | S        |
| T6  | `useDashboardStats` montado en 5 componentes distintos (misma query key); cualquier invalidación refetchea a todos             | Baja      | `apps/web/.../DashboardPage.tsx:46` · `WorkspacePage.tsx:56` · `ActivityTab.tsx:8` · `SidePanel.tsx:92` · `AiAssistant.tsx:92` | S        |
