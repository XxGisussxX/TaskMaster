# GUÍA DE NAVEGACIÓN DE TASKMASTER

Guía para entender el proyecto y saber dónde tocar cuando algo falla.

Taskmaster es una app de gestión de tareas (tipo Trello/Jira simplificado) construida
como **monorepo**: un solo repo con varias mini-apps que se talkean entre sí.

**Analogía:** es como un edificio de oficinas. Cada carpeta es un piso (los módulos
de la API), hay un portero que revisa quién entra (el login), y hay un directorio
central donde se anotan todos los datos (PostgreSQL). Cuando algo falla, primero
hay que saber en qué piso está el problema.

**La regla de oro:** si tocás el backend, tocás `apps/api`. Si tocás lo que el
usuario ve, tocás `apps/web`. Si tocás algo que comparten ambos, tocás
`packages/contracts`.

---

## 1. Mapa de carpetas

### Raíz

| Carpeta              | Qué es                                                                | Analogía                      |
| -------------------- | --------------------------------------------------------------------- | ----------------------------- |
| `apps/api`           | Backend NestJS. Toda la lógica de negocio.                            | Los empleados                 |
| `apps/web`           | Frontend React + Vite. Lo que el usuario ve y toca.                   | La cara del edificio          |
| `packages/contracts` | Esquemas Zod compartidos entre API y web.                             | El contrato laboral           |
| `packages/domain`    | Reglas de negocio puras, sin base de datos.                           | El manual de procedimientos   |
| `packages/config`    | Configuración de TypeScript, ESLint y Prettier compartida.            | La logística                  |
| `docker/`            | `api.Dockerfile`, `web.Dockerfile`, `nginx.conf`, `api-entrypoint.sh` | La maquinaria de construcción |
| `apps/api/prisma`    | Schema, migraciones y seeds de la base de datos.                      | El plano del edificio         |

### `apps/api/src/modules` — 23 módulos

Cada módulo es una **funcionalidad completa** con su controller, service y tests.
No son carpetas arbitrarias: un módulo = una pantalla o un concepto del negocio.

```
activity            → bitácora de cambios
admin               → panel de administración
ai                  → asistente con IA
auth                → login, refresh, logout, verificación por email
channels            → canales de proyecto (antes categorías)
comments            → comentarios y menciones
custom-fields       → campos personalizados
dashboard           → métricas y tarjetas
health              → chequeo de salud (lo usa Docker)
mail                → envío de emails (Resend)
notes               → notas adjuntas
notifications       → notificaciones
reminders           → recordatorios
saved-views         → vistas guardadas de filtros
tags                → etiquetas
task-dependencies   → dependencias entre tareas
task-templates      → plantillas de tareas
tasks               → CRUD de tareas (el módulo central)
time-entries        → registro de horas
uploads             → subida de archivos (Cloudinary)
users               → perfil de usuario
websocket           → actualizaciones en tiempo real
workspaces          → workspaces, miembros e invitaciones
```

**El que más te vas a tocar es `tasks`.** Si algo falla al crear o editar una
tarea, el 80% de las veces el problema está ahí o en `workspaces` (permisos).

### `apps/web/src/features` — 20 features

Misma idea que en la API, pero del lado del navegador:

```
admin  ai  attachments  auth  calendar  custom-fields  dashboard  invite
misc   notes  notifications  palette  reminders  saved-views  settings
task-dependencies  task-templates  tasks  time-entries  users  workspace
```

Dentro de cada feature vas a encontrar siempre la misma estructura:

```
pages/       → la pantalla (ej: TasksPage.tsx)
components/  → la UI (ej: TaskForm.tsx, TaskModal.tsx)
hooks/       → la lógica de datos (ej: useTasks.ts)
api/         → las llamadas HTTP (ej: tasks.api.ts)
```

Si no encontrás algo, es porque está en `api/`, no en `components/`. Ese es el
error más común cuando mulai el proyecto.

### `packages/contracts` — el contrato compartido

```
src/schemas/   → esquemas Zod (createTaskSchema, loginSchema, etc.)
src/enums.ts   → TaskStatus, TaskPriority, etc.
src/index.ts   → todo lo exportado
```

Si cambiás un enum acá, **se actualiza el frontend y el backend juntos**. Es la
forma de no tener "valores mágicos" repetidos en 30 archivos.

---

## 2. Tres flujos críticos para entender el proyecto

Estos tres flujos explican el 90% de la app. Seguí cada paso como si fuera una
pizza: la slice viaja del navegador a la base y vuelve.

### Flujo A: Login

El usuario escribe email y contraseña. La API verifica y le devuelve un token.

| #   | Qué pasa                                            | Archivo                                          | Tabla de DB    |
| --- | --------------------------------------------------- | ------------------------------------------------ | -------------- |
| 1   | El usuario escribe email y contraseña               | `apps/web/src/features/auth/pages/LoginPage.tsx` | —              |
| 2   | El botón llama a la función de login                | `apps/web/src/features/auth/api/auth.api.ts`     | —              |
| 3   | Viaja un `POST /api/auth/login`                     | idem                                             | —              |
| 4   | La API recibe y valida el cuerpo con Zod            | `apps/api/src/modules/auth/auth.controller.ts`   | —              |
| 5   | Verifica la contraseña y crea el token              | `apps/api/src/modules/auth/auth.service.ts`      | `User`         |
| 6   | Guarda el refresh token y pone la cookie            | idem                                             | `RefreshToken` |
| 7   | Guarda la sesión en el navegador                    | `apps/web/src/store/auth.store.ts`               | —              |
| 8   | En cada request se manda el `Authorization: Bearer` | `apps/web/src/services/http.ts`                  | —              |
| 9   | Si el access token venció, se renueva solo          | `apps/web/src/services/http.ts`                  | `RefreshToken` |

**Lo que tenés que saber:**

- El access token vive **en memoria** (el `store`). El refresh token viaja en una
  cookie `HttpOnly` llamada `tm_refresh`, que JavaScript **no puede leer**. Por eso
  no es vulnerable a XSS.
- La cookie dura `JWT_REFRESH_TTL` (por defecto `30d`), el token `15m`.
- `auth.store.ts` persiste la sesión, así que si recargás la página no te saca.

**Si el login falla:** empezá siempre por `auth.service.ts` y confirmá que el
usuario existe en la tabla `User`. Ojo con la sensibilidad a mayúsculas: los
emails se guardan en minúsculas.

### Flujo B: Crear una tarea

El corazón de la app. Un usuario crea una tarea dentro de un workspace.

| #   | Qué pasa                                              | Archivo                                                       | Tabla de DB               |
| --- | ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| 1   | Click en "Nueva tarea"                                | `apps/web/src/features/tasks/pages/TasksPage.tsx`             | —                         |
| 2   | Se abre el modal                                      | `apps/web/src/features/tasks/components/TaskModal.tsx`        | —                         |
| 3   | Se completa el formulario (título, estado, prioridad) | `apps/web/src/features/tasks/components/TaskForm.tsx`         | —                         |
| 4   | `useCreateTask` valida con Zod antes de enviar        | `apps/web/src/features/tasks/hooks/useTasks.ts`               | —                         |
| 5   | Viaja un `POST /api/workspaces/:workspaceId/tasks`    | `apps/web/src/features/tasks/api/tasks.api.ts`                | —                         |
| 6   | La API valida los params y el cuerpo                  | `apps/api/src/modules/tasks/tasks.controller.ts`              | —                         |
| 7   | **Verifica que el usuario sea miembro del workspace** | `apps/api/src/modules/workspaces/workspace-access.service.ts` | `WorkspaceMember`         |
| 8   | Crea la tarea en una transacción                      | `apps/api/src/modules/tasks/tasks.service.ts`                 | `Task`                    |
| 9   | Asocia responsables y etiquetas                       | idem                                                          | `TaskAssignee`, `TaskTag` |
| 10  | La lista de tareas se refresca sola                   | `apps/web/src/features/tasks/hooks/useTasks.ts`               | `Task`                    |

**Lo que tenés que saber:**

- **El paso 7 es el más importante.** Cada acceso a un workspace pasa por
  `workspace-access.service.ts`. Si un usuario ve `403 Forbidden`, el problema
  casi seguro está ahí o en que la fila en `WorkspaceMember` no existe.
- Una tarea **nunca** está sola en la base: tiene como mínimo un `workspaceId`.
- Los responsables y las etiquetas se guardan en tablas aparte
  (`TaskAssignee`, `TaskTag`) porque son relaciones de muchos a muchos.
- La creación es una **transacción**: si falla la parte de etiquetas, no queda
  ninguna tarea huérfana.

**Si crear una tarea falla:** revisá en este orden el schema Zod
(`packages/contracts/src/schemas`), después los permisos, y al final el service.

### Flujo C: Invitar a un miembro

Un usuario invite a otro por email y el invitado se une al workspace.

| #   | Qué pasa                                           | Archivo                           | Tabla de DB               |
| --- | -------------------------------------------------- | --------------------------------- | ------------------------- |
| 1   | El owner abre el diálogo de invitar                | `apps/web/src/features/invite`    | —                         |
| 2   | Se envía el email con un token                     | `apps/web/src/modules/mail` (API) | `Invite`                  |
| 3   | Se genera un hash del token, no se guarda en claro | `apps/api/src/modules/workspaces` | `Invite`                  |
| 4   | El invitado clickea el link del email              | `apps/web/src/features/invite`    | `Invite`                  |
| 5   | Valida el token y crea la membresía                | `apps/api/src/modules/workspaces` | `WorkspaceMember`, `User` |
| 6   | El workspace ya muestra al nuevo miembro           | `apps/web/src/features/workspace` | `WorkspaceMember`         |

**Lo que tenés que saber:**

- El token de invitación se guarda **hasheado** (SHA-256), igual que una
  contraseña. Si alguien lee la base de datos no puede usarlo para unirse.
- La tabla `Invite` tiene `invitedBy`: queda registro de **quién** invitó a quién
  y cuándo. Sirve para auditoría.
- Crear la `WorkspaceMember` es el paso que realmente da acceso. Si se crea la
  `Invite` pero no la `WorkspaceMember`, el invitado no ve nada.

---

## 3. Tabla de puntos de falla frecuentes

| Síntoma                                                | Causa probable                                              | Dónde mirar                                                          | Cómo lo arreglo                                                                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized` en toda la app                      | El access token venció y el refresh falló                   | `apps/web/src/services/http.ts`                                      | Revisá que la cookie `tm_refresh` siga existiendo; si no, el usuario tiene que volver a hacer login                        |
| `403 Forbidden` en una acción                          | El usuario no es miembro del workspace                      | `apps/api/src/modules/workspaces/workspace-access.service.ts`        | Confirmá que exista la fila en `WorkspaceMember` para ese usuario y workspace                                              |
| `401` solo en un módulo                                | Falta el decorador `@UseGuards(JwtAuthGuard)`               | El controller del módulo (`apps/api/src/modules/*/`*.controller.ts`) | Agregá el guard al endpoint. Los endpoints públicos son la excepción (login, health)                                       |
| `400 Bad Request` con un mensaje de Zod                | El frontend y la API no coinciden                           | `packages/contracts/src/schemas/`                                    | El error real viene en `message`: lista el campo exacto que falló. No lo adivines                                          |
| La tarea se crea pero no aparece en la lista           | El hook no se invalidó                                      | `apps/web/src/features/tasks/hooks/useTasks.ts`                      | Revisá que el `onSuccess` invalide el query de la lista                                                                    |
| Sale `NaN` o `undefined` en un campo del form          | El schema cambió y el form quedó desactualizado             | `TaskForm.tsx` + el schema en `packages/contracts`                   | El enum es la fuente de verdad. Mirá `packages/contracts/src/enums.ts`                                                     |
| La app no arranca: `Configuración de entorno inválida` | Falta o está mal una variable                               | `apps/api/src/config/env.config.ts`                                  | El error **nombra la variable exacta**. No hay que adivinar. Verificá contra `.env.example`                                |
| CORS: el navegador bloquea la request                  | `API_ORIGINS` no incluye el origen del frontend             | `apps/api/src/config/cors.ts`                                        | Es **fail-closed**: sin origins definidos, la API **no arranca**. Definí `API_ORIGINS=http://localhost:5173` en desarrollo |
| Los cambios en caliente no se aplican                  | El watcher de Nest no detectó el archivo                    | `pnpm dev`                                                           | A veces hay que reiniciar. `pnpm --filter @taskmaster/api dev`                                                             |
| `EPERM` al correr `pnpm install` o tests               | La API está corriendo y tiene bloqueado un `.dll` de Prisma | —                                                                    | Detené la API primero. En Windows el archivo queda tomado                                                                  |
| La IA no responde                                      | Falta la API key de OpenAI o se agotó la cuota              | `apps/api/src/modules/ai`                                            | `OPENAI_API_KEY` en `.env`. Hay cuota diaria                                                                               |
| Emails que no llegan                                   | Falta API key del proveedor                                 | `apps/api/src/modules/mail`                                          | `RESEND_API_KEY`. En desarrollo se loguean en consola                                                                      |

### Un caso real que vale la pena conocer

Este ejemplo muestra por qué los tests valen la pena. En `env.config.ts` se agregó
una regla que exige `TRUST_PROXY >= 1` en producción. Para implementarla se
agregó `TRUST_PROXY` a un esquema de validación, pero **se olvidó pasarlo** cuando
se llamaba a ese esquema. El resultado: `TRUST_PROXY` llegaba `undefined`,
Zod lo convertía a `NaN`, y **toda** validación de entorno fallaba, incluso en
desarrollo.

La app seguía funcionando porque el proceso que estaba corriendo era un build
viejo. Falló recién en el próximo reinicio.

Dos lecciones:

1. Un `safeParse` que recibe un objeto literal incompleto no avisa: simplemente
   da el resultado que le falta. Si el esquema pide campos, hay que pasarlos todos.
2. Los tests de configuración son baratos y detectan esto en 1 segundo. Corré
   `pnpm test` después de tocar validaciones de entorno.

---

## 4. Los 10 comandos que vas a necesitar

Todos se corren **desde la raíz del repo**.

| #   | Comando                                                   | Qué hace                                                                   | Cuándo usarlo                                           |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | `pnpm install`                                            | Instala dependencias de todo el monorepo. Corre `prisma generate` al final | La primera vez, o cuando agregás una dependencia        |
| 2   | `pnpm dev`                                                | Levanta API y web en paralelo, con recarga automática                      | Para trabajar. Web en `:5173`, API en `:4000`           |
| 3   | `pnpm dev:api`                                            | Solo la API, en modo watch                                                 | Cuando tocás backend y querés logs más limpios          |
| 4   | `pnpm dev:web`                                            | Solo el frontend                                                           | Cuando no tocás nada del backend                        |
| 5   | `pnpm test`                                               | Corre los tests de todos los paquetes                                      | Después de cada cambio. Es lo más importante            |
| 6   | `pnpm lint`                                               | Revisa estilo y errores comunes                                            | Antes de commitear                                      |
| 7   | `pnpm typecheck`                                          | Verifica tipos sin compilar                                                | Cuando TypeScript se queja de algo raro                 |
| 8   | `pnpm db:migrate`                                         | Crea y aplica una migración de Prisma                                      | Cuando cambiaste `schema.prisma`. Te pregunta el nombre |
| 9   | `pnpm db:seed`                                            | Carga datos iniciales y datos demo                                         | Cuando la base está vacía o querés empezar de cero      |
| 10  | `docker compose -f docker-compose.prod.yml up -d --build` | Levanta el stack completo: web, API, Redis y Caddy                         | Para probar cómo se ve en producción real               |

### Comandos de apoyo

Estos no están en el top 10, pero aparecen seguido:

```bash
pnpm build                  # Compila todo el monorepo
pnpm format                 # Aplica Prettier a todo
docker compose up -d        # Solo PostgreSQL y Redis (desarrollo)
pnpm --filter @taskmaster/api prisma:deploy   # Aplica migraciones sin crearlas (producción)
pnpm --filter @taskmaster/api prisma:studio   # Abre Prisma Studio para ver los datos
```

### Orden típico cuando arrancás un proyecto nuevo

```bash
pnpm install                # 1. Instalar
docker compose up -d        # 2. Levantar PostgreSQL y Redis
cp .env.example .env        # 3. Copiar las variables de entorno (y editarlas)
pnpm db:migrate             # 4. Crear las tablas
pnpm db:seed                # 5. Cargar datos demo
pnpm dev                    # 6. Arrancar
```

---

## 5. Los 15 archivos clave

Si solo pudieras mirar 15 archivos antes de tocar el proyecto, que sean estos.

### Arranque y configuración (3)

| #   | Archivo                             | Por qué importa                                       | Qué pasa si lo rompes                                   |
| --- | ----------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| 1   | `apps/api/src/main.ts`              | Arranca NestJS: CORS, cookies, puerto, prefijo `/api` | La API no levanta, o no acepta requests del frontend    |
| 2   | `apps/api/src/app.module.ts`        | Conecta todos los módulos. Importa `validateEnv`      | Un módulo no se registra y sus rutas dan `404`          |
| 3   | `apps/api/src/config/env.config.ts` | Valida todas las variables de entorno con Zod         | La API no arranca. El error nombra la variable faltante |

### Contratos y base de datos (3)

| #   | Archivo                           | Por qué importa                                                 | Qué pasa si lo rompes                                 |
| --- | --------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| 4   | `packages/contracts/src/schemas/` | Define qué datos son válidos. Fuente de verdad de la validación | El frontend manda algo que la API rechaza (`400`)     |
| 5   | `packages/contracts/src/enums.ts` | `TaskStatus`, `TaskPriority` y similares                        | La app usa valores que no existen en la base          |
| 6   | `apps/api/prisma/schema.prisma`   | Define las tablas, columnas y relaciones                        | La base no refleja el código. Necesitás una migración |

### Autenticación y permisos (3)

| #   | Archivo                                                       | Por qué importa                                      | Qué pasa si lo rompes                          |
| --- | ------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- |
| 7   | `apps/api/src/modules/auth/auth.service.ts`                   | Login, refresh, logout y verificación de contraseñas | Nadie puede entrar a la app                    |
| 8   | `apps/api/src/modules/auth/jwt.strategy.ts`                   | Valida el token en cada request                      | Todo devuelve `401`, o nada valida nada        |
| 9   | `apps/api/src/modules/workspaces/workspace-access.service.ts` | Decide si un usuario puede tocar un workspace        | Fuga de datos entre workspaces, o `403` falsos |

### La funcionalidad central (3)

| #   | Archivo                                          | Por qué importa                                        | Qué pasa si lo rompes                  |
| --- | ------------------------------------------------ | ------------------------------------------------------ | -------------------------------------- |
| 10  | `apps/api/src/modules/tasks/tasks.service.ts`    | Toda la lógica de tareas: crear, editar, borrar, mover | No se pueden crear ni modificar tareas |
| 11  | `apps/api/src/modules/tasks/tasks.controller.ts` | Define las rutas HTTP de tareas                        | Rutas dan `404` o `405`                |
| 12  | `apps/web/src/features/tasks/hooks/useTasks.ts`  | Cómo el frontend pide, crea y actualiza tareas         | La pantalla no refleja los cambios     |

### Infraestructura compartida (3)

| #   | Archivo                            | Por qué importa                                           | Qué pasa si lo rompes                                        |
| --- | ---------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| 13  | `apps/web/src/services/http.ts`    | Cliente HTTP: base URL, token Bearer y refresh automático | Se pierde la sesión sola, o ninguna request llega al backend |
| 14  | `apps/web/src/app/router.tsx`      | Define qué pantalla se ve en cada URL                     | Rutas rompen, pantallas inaccesibles                         |
| 15  | `apps/web/src/store/auth.store.ts` | Guarda la sesión y el usuario                             | El usuario pierde la sesión al recargar                      |

### Bonus: dos que vas a necesitar tarde

```bash
apps/api/src/modules/websocket/websocket.gateway.ts   # Actualizaciones en tiempo real
docker-compose.prod.yml                               # Cómo se despliega todo junto
```

> **Ojo con `websocket.gateway.ts`:** resuelve el CORS **al importarse** el
> módulo, antes de que exista inyección de dependencias. Por eso, si
> `API_ORIGINS` no está definido, la API no arranca. Y en los tests hay que
> definirlo antes del import.

---

## 6. Ejercicio práctico: cambiar el botón de login

**Objetivo:** cambiar el texto del botón de "Iniciar sesión" a "Entrar a Taskmaster".

Este ejercicio sirve para que veas el camino completo de un cambio de UI. No es
un cambio de negocio, así que no toca la base de datos.

### Paso 1: encontrá el archivo

Ya lo sabés por la sección 2 (Flujo A): el paso 1 del login es
`apps/web/src/features/auth/pages/LoginPage.tsx`. Abrilo y buscá el botón.

### Paso 2: cambiá el texto

En `LoginPage.tsx` vas a ver algo parecido a esto:

```tsx
<Button type="submit" className="w-full" disabled={loading}>
  {loading ? "Entrando…" : "Iniciar sesión"}
</Button>
```

El texto visible es `"Iniciar sesión"`. Reemplazalo por `"Entrar a Taskmaster"`.

### Paso 3: verificá

```bash
pnpm dev:web
```

Abrí `http://localhost:5173` y hacé login. El botón debería decir
"Entrar a Taskmaster" cuando no está cargando, y "Entrando…" mientras espera.

### Qué aprendiste

- Un cambio de texto **no toca la API ni la base de datos**. Solo el frontend.
- El `LoginPage.tsx` es el **paso 1** del Flujo A de la sección 2. Ahora lo
  entendés de verdad.
- Mirá que el botón ya tenía un estado de carga (`loading`). Tu cambio lo
  respeta: el texto de carga sigue igual.

### Ahora el desafío: hacerlo de verdad

Repetí el ejercicio con un cambio que **sí** toca el backend:

1. Agregá un campo opcional `rememberMe` al login.
2. Empezás por el schema: `packages/contracts/src/schemas/` (el loginSchema).
3. Después el controller: `apps/api/src/modules/auth/auth.controller.ts`.
4. Después el service: `apps/api/src/modules/auth/auth.service.ts`, que es el que
   decide cuánto dura la cookie `tm_refresh`.
5. Al final el frontend: `apps/web/src/features/auth/`.

Ese es el orden: **contrato primero, después API, después frontend.** Al revés,
TypeScript y Zod te van a dar errores en todas partes.

---

## Resumen en una línea

Si algo falla, preguntate: **¿es UI, es negocio o es un permiso?**
UI es `apps/web`. Negocio es `apps/api/src/modules`. Permisos es
`workspace-access.service.ts`. Y si no encontrás el dato, está en
`apps/api/prisma/schema.prisma`.
