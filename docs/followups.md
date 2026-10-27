# Follow-ups (issues pendientes)

Hallazgos de la revisión de producto (Parte 1 y Parte 2) que **no** se tocaron
en este PR. Cada entrada tiene severidad (Alta/Media/Baja), la ubicación
`archivo:línea` que lo prueba y un esfuerzo estimado (S/M/L/XL). Las marcadas
`_(resuelto)_` se cerraron en fases posteriores y quedan como referencia de lo
que había; el resto sigue siendo deuda técnica para priorizar.

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
> - Notas/UI: N3 (la búsqueda va con `useDebounce`) y N5 (el form importa
>   `MAX_NOTE_CONTENT_CHARS` de los contracts, la misma cota que valida el server)
>   están hechos.
> - UI: N9 (el cliente también descarta `//host` protocol-relative, como el server)
>   y N10 (la paleta usa los hooks `useTasks`/`useNotes`, así comparte la query key
>   canónica y se refresca con las invalidaciones de las páginas) están hechos.
> - DreamBoard: D1 (el arrastre actualiza el cache de forma optimista y no refetchea
>   el tablero entero en cada movimiento; los cambios de contenido sí invalidan)
>   está hecho.
>
> Resueltos después (auditoría de producto):
>
> - Notas: N4 (la UI usa `POST /pin` y `/unpin` en vez de reenviar el formulario,
>   y las notas `CHECKLIST` editan sus ítems contra el endpoint de checklist, con
>   fallback en `localNotes.ts` para el workspace demo).
> - DreamBoard: D3 (el pin guarda `imagePublicId` junto a la URL; el borrado usa
>   ese id y solo deriva de la URL en pins viejos o imágenes externas).
> - Dashboard: T6 (`useDashboardStats` acepta un `select`; cada consumidor elige
>   solo su porción —actividad, carga del equipo o KPIs del asistente— y deja de
>   re-renderizarse por invalidaciones que no le conciernen).

## Notas

| #   | Hallazgo                                                                                           | Severidad | Ubicación                                                                                                               | Esfuerzo       |
| --- | -------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- | -------------- |
| N4  | Endpoints de pin/unpin y checklist sin uso: la UI hace pin vía `update` y no tiene editor de items | Media     | `apps/api/src/modules/notes/notes.controller.ts:85-148` · `apps/web/.../NoteForm.tsx` (sin editor) · `NotesPage.tsx:54` | M _(resuelto)_ |
| N8  | Modo local (workspace demo) guarda HTML sin sanitizar y no respeta orden por pinned                | Media     | `apps/web/.../localNotes.ts:128-129,92-95`                                                                              | S _(resuelto)_ |

## DreamBoard

| #   | Hallazgo                                                                                                                                                                                                   | Severidad | Ubicación                                                                                                                 | Esfuerzo       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- | -------------- |
| D3  | Imágenes huérfanas: los pins guardan solo la `url` de Cloudinary (sin `publicId`), así que el borrado del asset depende de derivar el `publicId` desde la URL; sin Cloudinary cae a `data:` base64 gigante | Media     | `apps/api/src/modules/dream-board/dream-board.service.ts` · `apps/api/src/modules/uploads/uploads.service.ts:227,232-234` | M _(resuelto)_ |

## IA

| #   | Hallazgo                                                             | Severidad | Ubicación                                                                                               | Esfuerzo |
| --- | -------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- | -------- |
| I9  | Sin streaming: POST bloqueante (hasta 30 s) con typewriter cosmético | Media     | `apps/api/src/modules/ai/gemini.provider.ts:61-133` · `apps/web/src/features/ai/hooks/useTypewriter.ts` | L        |

### I9 — plan de streaming (pendiente)

El `POST /ai/assistant` devuelve un `AssistantResponse` completo (respuesta +
acciones) y el frontend lo "tipea" con `useTypewriter` recién cuando ya llegó.
Para streamear de verdad hacen falta tres cambios coordinados:

1. **Provider**: `GeminiProvider.completeJson` usa `:generateContent`; sumar un
   `streamJson` con `:streamGenerateContent?alt=sse` que parsee los eventos SSE y
   emita deltas de texto. El JSON final se sigue validando con `spec.zod` al
   cerrar el stream: un JSON parcial no se puede parsear ni validar.
2. **API**: endpoint `POST /ai/assistant/stream` con `text/event-stream`
   (`@Res()` + `flushHeaders()`), reenviando `delta` y cerrando con un evento
   `done` que lleve `actions`/`usage`. El endpoint actual queda como fallback
   (clientes viejos, camino determinístico y tests). El throttle y la cuota
   diaria se aplican igual, antes de abrir el stream.
3. **Web**: `fetch` con `ReadableStream` en `aiApi.assistantStream` (el helper
   `http` solo habla JSON), acumulando deltas en la entrada del asistente en vez
   de `useTypewriter`. Los `actions` se agregan al final, así el chip de
   confirmación sigue apareciendo solo cuando la respuesta está completa.

Riesgos a cubrir: proxies que bufferean SSE (`X-Accel-Buffering: no` +
`Cache-Control: no-cache`), cancelación (abortar el fetch al cerrar el panel y
abortar la llamada a Gemini), reintentos solo antes del primer byte y tests del
parser SSE con chunks partidos en medio de un evento.

## Dashboard / time-entries / agenda

| #   | Hallazgo                                                                                                           | Severidad | Ubicación                                                                                                                      | Esfuerzo       |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| T6  | `useDashboardStats` montado en 5 componentes distintos (misma query key); cualquier invalidación refetchea a todos | Baja      | `apps/web/.../DashboardPage.tsx:46` · `WorkspacePage.tsx:56` · `ActivityTab.tsx:8` · `SidePanel.tsx:92` · `AiAssistant.tsx:92` | S _(resuelto)_ |

## Dependencias

| #   | Hallazgo                                                                                                                                                                                                                                                                         | Severidad | Ubicación                                                                                                                             | Esfuerzo |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Z1  | `zod` 3.25.76 tiene un DoS de memoria (GHSA-mrhx-c7xc-m3w5) y el fix solo existe en 4.6.6+; hoy está exceptuado en `.ci/audit-allowlist.json`. El salto a Zod 4 es un major: obliga a subir `@hookform/resolvers` a la 5.x y a pasar los `z.record` a la firma de dos argumentos | Media     | `pnpm-workspace.yaml` · `.ci/audit-allowlist.json` · `packages/contracts/src/schemas/auth.schema.ts:64` · `task-template.schema.ts:7` | M        |
