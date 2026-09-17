import { Prisma } from "@prisma/client";
import { tenantContext } from "../tenant/tenant-context";

/**
 * Modelos que poseen una columna `workspaceId` y que, por lo tanto, se
 * auto-filtran contra el workspace del contexto. Quedan fuera:
 * - Modelos sin columna `workspaceId` (Comment, CustomFieldValue, join tables).
 * - Modelos user-scoped (User, UserSettings) o globales (Workspace, Notification).
 *
 * `Notification` tiene `workspaceId` nullable pero se consulta por `userId`, por
 * lo que no debe restringirse al workspace activo.
 */
export const SCOPED_MODELS: ReadonlySet<string> = new Set([
  "ActivityLog",
  "Attachment",
  "Category",
  "CustomFieldDefinition",
  "Invite",
  "Note",
  "Reminder",
  "SavedView",
  "Tag",
  "Task",
  "TaskDependency",
  "TaskTemplate",
  "TimeEntry",
  "WorkspaceMember",
]);

type ModelArgs = Record<string, any>;

function withWorkspaceId(where: unknown, workspaceId: string): ModelArgs {
  return { ...((where ?? {}) as ModelArgs), workspaceId };
}

function withWorkspaceIdFilter(where: unknown, workspaceId: string): ModelArgs {
  if (!where) return { workspaceId };
  return { AND: [where, { workspaceId }] };
}

/**
 * Inyecta/filtra `workspaceId` en los argumentos de una operación de Prisma.
 *
 * - create/createMany/upsert: fuerza el `workspaceId` en los datos.
 * - findUnique/update/delete/upsert: combina `workspaceId` en el `where` único
 *   (soportado por `extendedWhereUnique`, GA desde Prisma 5).
 * - findMany/findFirst/count/aggregate/groupBy/updateMany/deleteMany: envuelve el
 *   `where` existente en un `AND` para respetar `OR`/`NOT` del llamador.
 */
export function scopeArgs(
  operation: string,
  args: ModelArgs,
  workspaceId: string,
): ModelArgs {
  switch (operation) {
    case "create":
      return { ...args, data: { ...args.data, workspaceId } };
    case "createMany":
      return {
        ...args,
        data: (args.data ?? []).map((data: ModelArgs) => ({
          ...data,
          workspaceId,
        })),
      };
    case "upsert":
      return {
        ...args,
        where: withWorkspaceId(args.where, workspaceId),
        create: { ...args.create, workspaceId },
        update: { ...args.update, workspaceId },
      };
    case "findUnique":
    case "findUniqueOrThrow":
    case "update":
    case "delete":
      return { ...args, where: withWorkspaceId(args.where, workspaceId) };
    case "findMany":
    case "findFirst":
    case "findFirstOrThrow":
    case "count":
    case "aggregate":
    case "groupBy":
    case "updateMany":
    case "deleteMany":
      return {
        ...args,
        where: withWorkspaceIdFilter(args.where, workspaceId),
      };
    default:
      return args;
  }
}

/**
 * Extensión de Prisma que aplica aislamiento multi-tenant: cuando hay un
 * contexto de workspace activo, agrega automáticamente el filtro `workspaceId`
 * a toda operación sobre los modelos de {@link SCOPED_MODELS}.
 *
 * Funciona también dentro de transacciones interactivas: desde Prisma 4.16 el
 * cliente entregado en `$transaction(async (tx) => ...)` conserva las
 * extensiones del cliente extendido.
 */
export const tenantExtension = Prisma.defineExtension((client) =>
  client.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const context = tenantContext.get();
          if (!context || !SCOPED_MODELS.has(model)) return query(args);
          return query(
            scopeArgs(operation, args as ModelArgs, context.workspaceId),
          );
        },
      },
    },
  }),
);
